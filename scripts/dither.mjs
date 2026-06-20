// Bakes Bayer 8x8 ordered-dithered, 1-bit versions of the shelf covers into
// public/dither/, plus prints a small Bayer tile as a base64 data URI (used
// inline in CSS for the dithered-gradient motif).
//
// Run with: npm run dither
import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src", "assets", "shelf");
const OUT = path.join(__dirname, "..", "public", "dither");

// Classic 8x8 Bayer threshold matrix (values 0..63).
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];
const N = 8;

// Dithering only reads cleanly at ~1:1 or when upscaled — downscaling a 1-bit
// pattern produces moiré. Covers render at ~117px (1x desktop) and up, so we
// generate *below* that and let `image-rendering: pixelated` upscale into crisp
// chunky dots rather than mushing a larger pattern down.
const TARGET_W = 110;
const CONTRAST = 1.18; // nudge contrast before thresholding

async function ditherCover(file) {
  const name = path.parse(file).name;
  const { data, info } = await sharp(path.join(SRC, file))
    .greyscale()
    .linear(CONTRAST, 128 * (1 - CONTRAST))
    .resize({ width: TARGET_W })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lum = data[(y * width + x) * channels];
      const threshold = ((BAYER[y % N][x % N] + 0.5) / (N * N)) * 255;
      const on = lum > threshold ? 255 : 0;
      const o = (y * width + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = on;
      out[o + 3] = 255;
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true, colors: 2 })
    .toFile(path.join(OUT, `${name}.png`));
  return `${name}.png ${width}x${height}`;
}

async function bayerTile() {
  const out = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = Math.round(((BAYER[y][x] + 0.5) / (N * N)) * 255);
      const o = (y * N + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  const buf = await sharp(out, { raw: { width: N, height: N, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await sharp(buf).toFile(path.join(OUT, "bayer.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f));
for (const f of files) console.log("✓", await ditherCover(f));
console.log("\nBayer tile data URI:\n" + (await bayerTile()));
