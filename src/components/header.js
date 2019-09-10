import { Link } from "gatsby"
import PropTypes from "prop-types"
import React from "react"

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
          style={{
            color: `lightblue`,
            textDecoration: `none`,
          }}
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
      <h3 style={{
        padding: 10,
        paddingLeft: 20
        }}>
        <Link
          to="/about"
          style={{
            color: 'black',
            textDecoration: 'none'
          }}
        >
         about
        </Link>
      </h3>
      <h3 style={{
        padding: 10,
        paddingLeft: 20
        }}>
        <a
          href="https://drive.google.com/open?id=1dUgo6eloksdKyFjCc85N1WwpJmnR-z3X"
          style={{
            color: 'black',
            textDecoration: 'none'
          }}>
          resume
        </a>
      </h3>
      <h3 style={{
        padding: 10,
        paddingLeft: 20
        }}>
        <Link
          to="/blog"
          style={{
            color: 'black',
            textDecoration: 'none'
          }}>
          blog
        </Link>
      </h3>
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
