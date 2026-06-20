// WebGL dithering for the shelf covers.
//
// Each cover gets its own <canvas> layered over the (hidden) color image. A
// single shared WebGL context renders one cover at a time into an offscreen
// buffer, which is then blitted into the per-item canvas — this keeps us to one
// GL context (avoiding the browser's per-context limit) while letting per-item
// DOM handle layout, captions, borders, rounded corners and the filter reflow.
//
// The shader does ordered (Bayer 8x8) dithering at a chunky low-res grid, with
// a barely-there "boil" over time, and mixes toward the full-color image as a
// per-item `reveal` eases up on hover/focus.
//
// Everything here is a progressive enhancement: if WebGL is missing or the user
// prefers reduced motion we never start, and the baked-PNG DOM layer remains.

const VERT = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = (aPos + 1.0) * 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform sampler2D uBayer;
uniform vec2 uGrid;       // constant resting dither cells across the cover
uniform vec2 uUVScale;    // object-fit: cover crop
uniform vec2 uUVOffset;
uniform vec3 uInk;        // "on" dot color
uniform vec3 uPaper;      // "off" color (the card)
uniform float uProgress;  // 0 = dithered, 1 = full color
varying vec2 vUV;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 cell = floor(vUV * uGrid);
  vec2 boxLow = (cell + 0.5) / uGrid;
  vec3 low = texture2D(uTex, uUVOffset + boxLow * uUVScale).rgb;

  float l = clamp((luma(low) - 0.5) * 1.18 + 0.5, 0.0, 1.0); // match baked contrast
  float b = texture2D(uBayer, fract((cell + 0.5) / 8.0)).r;
  vec3 dith = mix(uPaper, uInk, step(b, l));

  vec3 full = texture2D(uTex, uUVOffset + vUV * uUVScale).rgb;

  // Dithered dissolve: each cell crossfades to full color when the rising tide
  // (uProgress) passes its threshold — ordered by the Bayer matrix with a touch
  // of per-cell jitter, so the image precipitates out of the grain. The chunk
  // size never changes.
  float edge = 0.16;
  float order = mix(b, hash(cell), 0.35);
  float x = uProgress * (1.0 + 2.0 * edge) - edge;
  float cellMix = smoothstep(order - edge, order + edge, x);

  gl_FragColor = vec4(mix(dith, full, cellMix), 1.0);
}`;

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36,
  14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23,
  61, 29, 53, 21,
];

// Supersample the canvas backing so the resolved (full-color) covers stay crisp
// at native size and under browser zoom. At least 2x; capped so the shared
// buffer stays reasonable. The dither chunk size is set in UV space (uGrid), so
// it's unaffected by this.
const SCALE = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
const GRID_W = 110; // resting dither cells across (matches the baked resolution)
const REVEAL_MS = 560; // hover dissolve duration

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Cover = {
  item: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  tex: WebGLTexture | null;
  loading: boolean;
  visible: boolean;
  reveal: number;
  target: number;
  w: number; // device px
  h: number;
  uvScale: [number, number];
  uvOffset: [number, number];
};

function hexToRGB(v: string): [number, number, number] {
  const s = v.trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = s.match(/(\d+(?:\.\d+)?)/g);
  if (rgb && rgb.length >= 3)
    return [+rgb[0] / 255, +rgb[1] / 255, +rgb[2] / 255];
  return [0, 0, 0];
}

export function initShelfDither(shelf: HTMLElement): boolean {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return false;

  const glCanvas = document.createElement("canvas");
  // Generous fixed size so we never resize per frame; we render each cover into
  // the top-left region via the viewport, then blit just that region. Sized to
  // hold the largest cover at the supersampled SCALE so the color reveal stays
  // crisp (covers are clamped to this if they'd exceed it).
  glCanvas.width = 512;
  glCanvas.height = 768;
  const gl = (glCanvas.getContext("webgl", {
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }) ||
    glCanvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  if (!gl) return false;

  try {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(sh) || "shader");
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) || "link");
    gl.useProgram(prog);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uTex = U("uTex");
    const uBayer = U("uBayer");
    const uGrid = U("uGrid");
    const uUVScale = U("uUVScale");
    const uUVOffset = U("uUVOffset");
    const uInk = U("uInk");
    const uPaper = U("uPaper");
    const uProgress = U("uProgress");

    // Bayer threshold lookup (8x8, nearest, repeating).
    const bayerPx = new Uint8Array(64 * 4);
    for (let i = 0; i < 64; i++) {
      const v = Math.round(((BAYER[i] + 0.5) / 64) * 255);
      bayerPx.set([v, v, v, 255], i * 4);
    }
    const bayerTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bayerTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 8, 8, 0, gl.RGBA, gl.UNSIGNED_BYTE, bayerPx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.uniform1i(uBayer, 1);
    gl.uniform1i(uTex, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    let ink: [number, number, number] = [0.93, 0.95, 0.96];
    let paper: [number, number, number] = [0.05, 0.07, 0.09];
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = hexToRGB(cs.getPropertyValue("--text-strong"));
      paper = hexToRGB(cs.getPropertyValue("--bg-elev"));
    };
    readTheme();

    const covers: Cover[] = [];
    shelf.querySelectorAll<HTMLElement>(".shelf-item").forEach((item) => {
      const canvas = item.querySelector<HTMLCanvasElement>(".cover-gl");
      const img = item.querySelector<HTMLImageElement>(".cover");
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true; // blit is 1:1; dither chunk = shader grid
      covers.push({
        item,
        canvas,
        ctx,
        img,
        tex: null,
        loading: false,
        visible: false,
        reveal: 0,
        target: 0,
        w: 0,
        h: 0,
        uvScale: [1, 1],
        uvOffset: [0, 0],
      });
    });
    if (!covers.length) return false;

    const sizeCover = (c: Cover) => {
      const r = c.item.getBoundingClientRect();
      c.w = Math.max(1, Math.round(Math.min(r.width * SCALE, glCanvas.width)));
      c.h = Math.max(1, Math.round(Math.min(r.height * SCALE, glCanvas.height)));
      c.canvas.width = c.w;
      c.canvas.height = c.h;
      c.ctx.imageSmoothingEnabled = true;
      // object-fit: cover crop from the image's aspect into the 2:3 box.
      const iw = c.img.naturalWidth || 2;
      const ih = c.img.naturalHeight || 3;
      const boxA = r.width / r.height;
      const imgA = iw / ih;
      if (imgA > boxA) {
        const s = boxA / imgA;
        c.uvScale = [s, 1];
        c.uvOffset = [(1 - s) / 2, 0];
      } else {
        const s = imgA / boxA;
        c.uvScale = [1, s];
        c.uvOffset = [0, (1 - s) / 2];
      }
    };

    const loadTexture = (c: Cover) => {
      if (c.tex || c.loading) return;
      c.loading = true;
      const upload = () => {
        try {
          const tex = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c.img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          c.tex = tex;
          sizeCover(c);
          kick(); // draw the (static) dithered rest state now that it's ready
        } catch {
          /* leave fallback in place for this cover */
        }
      };
      if (c.img.complete && c.img.naturalWidth) {
        c.img.decode().then(upload).catch(upload);
      } else {
        c.img.addEventListener(
          "load",
          () => c.img.decode().then(upload).catch(upload),
          { once: true },
        );
      }
    };

    // Only animate covers that are on screen.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const c = covers.find((x) => x.item === e.target);
          if (!c) continue;
          c.visible = e.isIntersecting;
          if (c.visible) loadTexture(c);
        }
        kick();
      },
      { rootMargin: "200px" },
    );
    covers.forEach((c) => io.observe(c.item));

    // Hover / focus intent.
    covers.forEach((c) => {
      const on = () => {
        c.target = 1;
        kick();
      };
      const off = () => {
        c.target = 0;
        kick();
      };
      c.item.addEventListener("pointerenter", on);
      c.item.addEventListener("pointerleave", off);
      c.item.addEventListener("focusin", on);
      c.item.addEventListener("focusout", off);
    });

    const baseGy = Math.round(GRID_W / (2 / 3));
    const draw = (c: Cover) => {
      if (!c.tex || !c.w) return;
      gl.viewport(0, glCanvas.height - c.h, c.w, c.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, c.tex);
      gl.uniform2f(uGrid, GRID_W, baseGy); // constant chunk size
      gl.uniform2f(uUVScale, c.uvScale[0], c.uvScale[1]);
      gl.uniform2f(uUVOffset, c.uvOffset[0], c.uvOffset[1]);
      gl.uniform3fv(uInk, ink);
      gl.uniform3fv(uPaper, paper);
      gl.uniform1f(uProgress, smoothstep(0, 1, c.reveal)); // gentle ease in/out
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      c.ctx.clearRect(0, 0, c.w, c.h);
      c.ctx.drawImage(glCanvas, 0, 0, c.w, c.h, 0, 0, c.w, c.h);
    };

    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      // Time-based so the transition lasts REVEAL_MS regardless of frame rate;
      // dt is clamped (and reset between runs) so restarting never jumps.
      const dt = last ? Math.min(now - last, 50) : 16;
      last = now;
      let busy = false;
      for (const c of covers) {
        if (!c.visible || !c.tex) continue;
        if (c.reveal !== c.target) {
          const step = dt / REVEAL_MS;
          c.reveal =
            c.target > c.reveal
              ? Math.min(c.target, c.reveal + step)
              : Math.max(c.target, c.reveal - step);
          busy = true;
        }
        draw(c);
      }
      if (busy && !document.hidden) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        last = 0; // next run starts fresh (no stale dt jump)
      }
    };
    function kick() {
      if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    }

    const onResize = () => {
      for (const c of covers) if (c.tex) sizeCover(c);
      kick();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", kick);
    const mo = new MutationObserver(() => {
      readTheme();
      kick();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", () => {
        readTheme();
        kick();
      });

    shelf.classList.add("gl-active");
    kick();
    return true;
  } catch {
    return false; // any failure → DOM fallback stays
  }
}
