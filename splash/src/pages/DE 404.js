import React from 'react'

import Layout from '../components/layout'
import SEO from '../components/seo'

const NotFoundPage = () => (
  <Layout>
    <SEO title="404: Seite nicht gefunden" />
    <h1>Seite nicht gefundenD</h1>
    <p>Du bist auf einem Pfad der nicht existiert... wie traurig.</p>
  </Layout>
)

export default NotFoundPage

