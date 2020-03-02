/**
 * Layout component could queries for data
 * if we wanted it to.
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import React from 'react'
import PropTypes from 'prop-types'
import Header from './header'
import './layout.css'

const Layout = ({ children }) => {
  return (
    <>
      <Header siteTitle="Signalboost" />
      <main>
        <div className="container">{children}</div>
      </main>
      <footer />
    </>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}

export default Layout
