const { commands } = require('../../../../app/dispatcher/commands/constants')
const { isCommand } = require('../../../../app/dispatcher/strings/commands')
const { expect } = require('chai')
const { describe, it } = require('mocha')

describe('#isCommand', () => {
  describe('given an undefined string', () => {
    it('returns false', () => {
      expect(isCommand(undefined, commands.JOIN)).to.eql(false)
    })
  })

  describe('given a string and matching command', () => {
    it('returns true', () => {
      expect(isCommand('HELLO', commands.JOIN)).to.eql(true)
    })
  })

  describe('given a string and a non-matching command', () => {
    it('returns false', () => {
      expect(isCommand('GOODBYE', commands.JOIN)).to.eql(false)
    })
  })
})
