import { describe, it } from 'mocha'
import { expect } from 'chai'
import messagesEN from '../../../../app/services/dispatcher/strings/messages/EN'
import messagesES from '../../../../app/services/dispatcher/strings/messages/ES'

describe('string translations', () => {
  describe('for messages', () => {
    it('has an ES string for every EN string', () => {
      expect(messagesES.systemName).to.exist
      Object.keys(messagesEN.commandResponses).forEach(
        key => expect(messagesES.commandResponses[key]).to.exist,
      )
      Object.keys(messagesEN.notifications).forEach(
        key => expect(messagesES.notifications[key]).to.exist,
      )
      Object.keys(messagesEN.prefixes).forEach(key => expect(messagesES.prefixes[key]).to.exist)
    })
  })
})
