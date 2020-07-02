import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'gatsby'
import headerStyles from './header.module.css'

const Header = ({ siteTitle }) => (
  <header>
    <nav className={`container ${headerStyles.nav}`}>
      <Link to="/">
        <h1 className={headerStyles.title}>{siteTitle}</h1>
      </Link>
      <div>
        <Link
          to="/how-to"
          className={headerStyles.nav__link}
          activeClassName={headerStyles.active}
        >
          How-to
        </Link>
        <Link
          to="/donate"
          className={headerStyles.nav__link}
          activeClassName={headerStyles.active}
        >
          Donate
        </Link>
      </div>
    </nav>
  </header>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
}

Header.defaultProps = {
  siteTitle: ``,
}

export default Header
