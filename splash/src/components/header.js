import React from 'react'
import PropTypes from 'prop-types'
import './header.css'

/**
 * NOTE: this version of the header corresponds to the version of the site showing
 * only the shutdown notice posted on 2021-08-20. To see the earlier version of the nav
 * that we used for actual content, see `components/headerLegacy.js`
 **/

class Header extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <header>
        <nav style={{ justifyContent: 'center' }} className="nav">
          <h1 className="title">{this.props.siteTitle}</h1>
        </nav>
      </header>
    )
  }
}

Header.propTypes = {
  siteTitle: PropTypes.string,
}

Header.defaultProps = {
  siteTitle: ``,
}

export default Header
