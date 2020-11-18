import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'gatsby'
import { slide as Menu } from 'react-burger-menu'
import './header.css'

class Header extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      menuOpen: true,
    }
  }

  handleStateChange(state) {
    this.setState({ menuOpen: state.isOpen })
  }

  render() {
    return (
      <header>
        <nav className="nav">
          <Link to="/">
            <h1 className="title">{this.props.siteTitle}</h1>
          </Link>
          <div className="nav__desktop">
            <NavItems />
          </div>
          <div className="nav__mobile">
            <Menu
              itemListElement="div"
              pageWrapId={'container'}
              isOpen={this.state.menuOpen}
              onStateChange={state => this.handleStateChange(state)}
            >
              <NavItems />
            </Menu>
          </div>
        </nav>
      </header>
    )
  }
}

const NavItems = () => (
  <React.Fragment>
    <Link to="/about" className="nav__link" activeClassName="active">
      About
    </Link>
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
