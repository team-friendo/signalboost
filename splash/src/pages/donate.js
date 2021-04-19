import React from 'react'
import Layout from '../components/layout'
import Helmet from 'react-helmet'
import { withPrefix } from 'gatsby'

const DonatePage = () => (
  <Layout>
    <Helmet>
      <script
        src={withPrefix('commitChangeWidget.js')}
        type="text/javascript"
      />
    </Helmet>
    <h3>Help us build the tech the movement needs.</h3>
    <p>
      We believe in building ethical tech that doesn't make money from spying on
      you or monetizing your data. Since we make this software for liberation,
      not profit, we rely on the material support of our community to keep the
      project afloat.
    </p>
    <p>
      We are humbled and inspired by the people using Signalboost to organize -
      from protest and occupation organizers to journalists and human rights
      defenders to mental health professionals. We remain deeply committed to
      protecting your digital safety, even if it means we sometimes have to foot
      the bill.
    </p>
    <p>
      It costs us a few bucks per month per channel to keep things up and
      running. Consider writing us into your organization's tech budget or make
      a one-time donation - either way, the funds go towards supporting this
      project and helping other organizers stay safe.
    </p>
    <h3>Make a tax-deductible donation here:</h3>
    <a
      data-amounts="5,10,25,50,100,500,1000"
      className="commitchange-donate"
      data-embedded=""
      data-hide-dedication=""
      style={{ marginBottom: '-5rem' }}
    ></a>
    <p>
      All donations go through our (amazing!) fiscal sponsor,{' '}
      <a href="https://aspirationtech.org">Aspiration Technology</a>. Aspiration
      earmarks all donations for exclusive use by Signalboost and provides
      donors with receipts for claiming tax deductions.
    </p>
  </Layout>
)

export default DonatePage
