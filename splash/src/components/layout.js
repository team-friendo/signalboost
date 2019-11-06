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
      <div
        style={{
          margin: `8rem auto 0 auto`, // TRBL
          maxWidth: 960,
          padding: `0px 1.0875rem 1.45rem`,
          paddingTop: 0,
        }}
      >
        <main>{children}</main>
        <footer />
      </div>
    </>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}

export default Layout
