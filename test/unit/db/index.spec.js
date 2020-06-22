import { expect } from 'chai'
import { describe, it, before } from 'mocha'
import sinon from 'sinon'
import dbService from '../../../app/db'
const {
  db: { maxConnectionAttempts },
} = require('../../../app/config')

describe('db module', () => {
  describe('#getDbConnection', () => {
    const sequelize = { authenticate: sinon.stub() }

    describe('when connection is achieved in less than max attempts', () => {
      before(() => {
        sequelize.authenticate.onCall(0).callsFake(() => Promise.reject())
        sequelize.authenticate.onCall(1).callsFake(() => Promise.reject())
        sequelize.authenticate.onCall(2).callsFake(() => Promise.resolve())
      })
      it('resolves a promise', async () => {
        expect(await dbService.getDbConnection(sequelize)).to.eql('db connected')
      })
    })
    describe('when connection is not achieved in less than max attempts', () => {
      before(() => {
        sequelize.authenticate.callsFake(() => Promise.reject())
      })
      it('rejects a promise', () => {
        return dbService
          .getDbConnection(sequelize)
          .catch(e =>
            expect(e.message).to.eql(
              `could not connect to db after ${maxConnectionAttempts} attempts`,
            ),
          )
      })
    })
  })
})
