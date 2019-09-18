import { expect } from 'chai'
import { describe, it } from 'mocha'
import { commands } from '../../../../../app/services/dispatcher/commands/constants'
import { parseCommand } from '../../../../../app/services/dispatcher/commands/parse'

describe('parsing commands', () => {
  describe('ADD PUBLISHER command', () => {
    it('parses an ADD PUBLISHER command (regardless of case or whitespace)', () => {
      expect(parseCommand('ADD')).to.eql({ command: commands.ADD, payload: '' })
      expect(parseCommand('add')).to.eql({ command: commands.ADD, payload: '' })
      expect(parseCommand(' add ')).to.eql({ command: commands.ADD, payload: '' })
    })

    it('parses the payload from an ADD PUBLISHER command', () => {
      expect(parseCommand('ADD foo')).to.eql({ command: commands.ADD, payload: 'foo' })
    })

    it('does not parse ADD PUBLISHER command if string starts with chars other than `add publisher`', () => {
      expect(parseCommand('do ADD')).to.eql({ command: commands.NOOP })
      expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
    })
  })

  describe('HELP command', () => {
    it('parses a HELP command in english (regardless of case or whitespace)', () => {
      expect(parseCommand('HELP')).to.eql({ command: commands.HELP })
      expect(parseCommand('help')).to.eql({ command: commands.HELP })
      expect(parseCommand(' help ')).to.eql({ command: commands.HELP })
    })

    it('parses a HELP command in spanish (regardless of case or whitespace)', () => {
      expect(parseCommand('AYUDA')).to.eql({ command: commands.HELP })
      expect(parseCommand('ayuda')).to.eql({ command: commands.HELP })
      expect(parseCommand(' ayuda ')).to.eql({ command: commands.HELP })
    })

    it('does not parse a HELP command when string contains characters other than `info`', () => {
      expect(parseCommand('i want help ')).to.eql({ command: commands.NOOP })
      expect(parseCommand('necesito ayuda')).to.eql({ command: commands.NOOP })
      expect(parseCommand('help me!')).to.eql({ command: commands.NOOP })
      expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
    })
  })

  describe('INFO command', () => {
    it('parses an INFO command (regardless of case or whitespace)', () => {
      expect(parseCommand('INFO')).to.eql({ command: commands.INFO })
      expect(parseCommand('info')).to.eql({ command: commands.INFO })
      expect(parseCommand(' info ')).to.eql({ command: commands.INFO })
    })

    it('does not parse an INFO command when string contains characters other than `info`', () => {
      expect(parseCommand('i want info ')).to.eql({ command: commands.NOOP })
      expect(parseCommand('info me!')).to.eql({ command: commands.NOOP })
      expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
    })
  })

  describe('JOIN command', () => {
    it('parses an JOIN command from "join" (regardless of case or whitespace)', () => {
      expect(parseCommand('JOIN')).to.eql({ command: commands.JOIN })
      expect(parseCommand('join')).to.eql({ command: commands.JOIN })
      expect(parseCommand(' join ')).to.eql({ command: commands.JOIN })
    })

    it('parses a JOIN command from "hello" (regardless of case or whitespace)', () => {
      expect(parseCommand('HELLO')).to.eql({ command: commands.JOIN })
      expect(parseCommand('hello')).to.eql({ command: commands.JOIN })
      expect(parseCommand(' hello ')).to.eql({ command: commands.JOIN })
    })

    it('parses a JOIN command from "hola" (regardless of case or whitespace)', () => {
      expect(parseCommand('HOLA')).to.eql({ command: commands.JOIN })
      expect(parseCommand('hola')).to.eql({ command: commands.JOIN })
      expect(parseCommand(' hola ')).to.eql({ command: commands.JOIN })
    })

    it('does not parse an JOIN command when string contains characters other than `join`', () => {
      expect(parseCommand('i wanna join ')).to.eql({ command: commands.NOOP })
      expect(parseCommand('join it!')).to.eql({ command: commands.NOOP })
      expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
    })
  })

  describe('LEAVE command', () => {
    it('parses a LEAVE command from "leave" regardless of case or whitespace', () => {
      expect(parseCommand('LEAVE')).to.eql({ command: commands.LEAVE })
      expect(parseCommand('leave')).to.eql({ command: commands.LEAVE })
      expect(parseCommand(' leave ')).to.eql({ command: commands.LEAVE })
    })

    it('parses a LEAVE command from "goodbye" regardless of case or whitespace', () => {
      expect(parseCommand('GOODBYE')).to.eql({ command: commands.LEAVE })
      expect(parseCommand('goodbye')).to.eql({ command: commands.LEAVE })
      expect(parseCommand(' goodbye ')).to.eql({ command: commands.LEAVE })
    })

    it('parses a LEAVE command from "adiós" regardless of case or whitespace', () => {
      expect(parseCommand('ADIOS')).to.eql({ command: commands.LEAVE })
      expect(parseCommand('adios')).to.eql({ command: commands.LEAVE })
      expect(parseCommand(' adios ')).to.eql({ command: commands.LEAVE })
    })

    it('does not parse a LEAVE command when string contains characters other than `leave`', () => {
      expect(parseCommand('i wanna leave ')).to.eql({ command: commands.NOOP })
      expect(parseCommand('leave now!')).to.eql({ command: commands.NOOP })
      expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
    })
  })

  describe('REMOVE PUBLISHER command', () => {
    it('parses an REMOVE command (regardless of case or whitespace)', () => {
      expect(parseCommand('REMOVE')).to.eql({ command: commands.REMOVE, payload: '' })
      expect(parseCommand('remove')).to.eql({ command: commands.REMOVE, payload: '' })
      expect(parseCommand(' remove ')).to.eql({ command: commands.REMOVE, payload: '' })
    })

    it('parses the payload from an REMOVE PUBLISHER command', () => {
      expect(parseCommand('REMOVE foo')).to.eql({ command: commands.REMOVE, payload: 'foo' })
    })

    it('does not parse REMOVE PUBLISHER command if string starts with chars other than `add publisher`', () => {
      expect(parseCommand('do REMOVE foo')).to.eql({ command: commands.NOOP })
      expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
    })
  })

  describe('RENAME command', () => {
    it('parses an RENAME command (regardless of case or whitespace)', () => {
      expect(parseCommand('RENAME')).to.eql({ command: commands.RENAME, payload: '' })
      expect(parseCommand('rename')).to.eql({ command: commands.RENAME, payload: '' })
      expect(parseCommand(' rename ')).to.eql({ command: commands.RENAME, payload: '' })
    })

    it('parses the payload from an RENAME command', () => {
      expect(parseCommand('RENAME foo')).to.eql({ command: commands.RENAME, payload: 'foo' })
    })

    it('does not parse RENAME command if string starts with chars other than `rename`', () => {
      expect(parseCommand('do RENAME')).to.eql({ command: commands.NOOP })
      expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
    })
  })

  describe('TOGGLE_RESPONSES command', () => {
    it('parses an TOGGLE_RESPONSES command (regardless of case or whitespace)', () => {
      expect(parseCommand('RESPONSES')).to.eql({
        command: commands.TOGGLE_RESPONSES,
        payload: '',
      })
      expect(parseCommand('responses')).to.eql({
        command: commands.TOGGLE_RESPONSES,
        payload: '',
      })
      expect(parseCommand(' responses ')).to.eql({
        command: commands.TOGGLE_RESPONSES,
        payload: '',
      })
    })

    it('parses the payload from an TOGGLE_RESPONSES command', () => {
      expect(parseCommand('RESPONSES foo')).to.eql({
        command: commands.TOGGLE_RESPONSES,
        payload: 'foo',
      })
    })

    it('does not parse TOGGLE_RESPONSES command if string starts with chars other than `responses`', () => {
      expect(parseCommand('do RESPONSES')).to.eql({ command: commands.NOOP })
      expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
    })
  })
})
