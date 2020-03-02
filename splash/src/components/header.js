import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'gatsby'

const Header = ({ siteTitle }) => (
  <header>
    <div className="container">
      <Link to="/">
        <h1
          style={{
            margin: '15px 0',
          }}
        >
          {siteTitle}
        </h1>
      </Link>
      {/* <Link to="/faq">FAQ</Link>
      <Link to="/how-to">How-to</Link> */}
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
