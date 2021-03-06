import React from "react"

import Layout from "../components/layout"
import SEO from "../components/seo"

import { LinkA } from "../components/styles"

const AboutPage = () => (
  <Layout>
    <SEO title="About" />
    <h1>About Me</h1>
    <p>I am pursuing a B.S. in Computer Science from the University of California, Santa Barbara.</p>
    <p>In the summer of 2019, I interned at Microsoft.</p>
    <p>I am particularly interested in modern front-end technologies.</p>
    <p>You can find me on <LinkA href="https://www.instagram.com/djohnburke/">Instagram</LinkA>, <LinkA href="https://www.linkedin.com/in/darragh-burke-875509163/">LinkedIn</LinkA>, and <LinkA href="http://github.com/darraghjburke">GitHub</LinkA>.</p>
  </Layout>
)

export default AboutPage
