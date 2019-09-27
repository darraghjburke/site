import { Link } from "gatsby"
import PropTypes from "prop-types"
import React from "react"

import { css } from "@emotion/core"

import { Colors } from "./styles"


const HeaderLink = css`
  text-decoration: none;
  color: black;
  padding: 10px;
  margin-left: 20px;
  &:hover {
    background-color: ${Colors.accent};
    color: white;
  }
  `

const Header = ({ siteTitle }) => (
  <header
    style={{
      background: `white`,
      marginBottom: `1.45rem`,
    }}
  >
    <div
      style={{
        margin: `0 auto`,
        maxWidth: 960,
        padding: `1.45rem 1.0875rem`,
        display: 'flex',
      }}
    >
      <h1 style={{ margin: 0 }}>
        <Link
          to="/"
          css={css`
            color: ${Colors.accent};
            text-decoration: none;
          `}
        >
          darragh 
        </Link>
        <Link
          to="/"
          style={{
            color: `black`,
            textDecoration: `none`,
            paddingLeft: 10
          }}
        >
           burke 
        </Link>
      </h1>
      <Link
        to="/about"
        css={HeaderLink}>      
        <h3>about</h3>
      </Link>
      <a
        href="https://drive.google.com/file/d/1-mwblk-gUAtCYSlPezjBA_qZcUHC8rNh/view"
        css={HeaderLink}
        target="_blank">
        <h3>resume</h3>
      </a>
      <Link
          to="/blog"
          css={HeaderLink}>
        <h3>blog</h3>
      </Link>
    </div>
  </header>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
}

Header.defaultProps = {
  siteTitle: ``,
}

export default Header
