import React from 'react'
import Layout from '../components/layout'
import SEO from '../components/seo'

/**
 * NOTE: this version of the index page features the shutdown notice we published
 * when shutting down the service on 2021-08-20. To view the index page as originally
 * written, see `pages/indexLegacy.js`
 **/

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: communicate with mass audiences securely and directly via message broadcasts and hotlines" />
    <blockquote className="command blockquote-skinny">
      <p>August 20, 2021</p>
      <p>
        We regret to inform you that Signalboost as it currently exists is
        shutting down.
      </p>
      <p>
        Since its inception, serving our users with integrity has been one of
        Signalboost's most important core values. It's never been easy to be a
        part of the rapidly changing ecosystem of encrypted messaging, in which
        the craft of building software and stewarding sensitive data deserves to
        be handled with resources and care. Despite our best efforts, we've been
        unable to both sustain ourselves and get the technology to the level of
        reliability and safety we believe our users deserve. Frankly, we're
        burnt out!
      </p>
      <p>
        As of today, the Signalboost service has been permanently shut down and,
        in the interest of privacy, all user data has been permanently
        destroyed. We remain deeply inspired by the many innovative ways that
        thousands of dedicated activists have used this tool to push for a more
        just world, and we apologize for having to bow out when there is so much
        important work left to do. Toward that end, we are seeking out a
        better-resourced, movement-aligned organization to adopt the project.
        You can check for updates on the status of that effort on this page.
      </p>
      <p>Thank you so much for your support.</p>
      <p>✨ 🖤 ✨</p>
      <p>The Signalboost Team</p>
    </blockquote>

    {/*<p style={{ textAlign: 'center' }}>*/}
    {/*  You can view an archived version of this site on the{' '}*/}
    {/*  <a href="https://web.archive.org/web/20210416110700/https://signalboost.info/">*/}
    {/*    Wayback Machine*/}
    {/*  </a>*/}
    {/*</p>*/}
  </Layout>
)

export default IndexPage
