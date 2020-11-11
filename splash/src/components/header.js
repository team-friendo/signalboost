import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'gatsby'
import './header.css'
import { slide as Menu } from 'react-burger-menu'

const Header = ({ siteTitle }) => (
  <header>
    <nav className="nav">
      <Link to="/">
        <h1 className="title">{siteTitle}</h1>
      </Link>
      <div className="nav__desktop">
        <NavItems />
      </div>
      <div className="nav__mobile">
        <Menu itemListElement="div" pageWrapId={'container'}>
          <NavItems />
        </Menu>
      </div>
    </nav>
  </header>
)

const NavItems = () => (
  <React.Fragment>
    <Link to="/how-to" className="nav__link" activeClassName="active">
      How-to
    </Link>
    <Link to="/donate" className="nav__link" activeClassName="active">
      Donate
    </Link>
    <Link to="/privacy" className="nav__link" activeClassName="active">
      Privacy
    </Link>
  </React.Fragment>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
}

Header.defaultProps = {
  siteTitle: ``,
}

export default Header
