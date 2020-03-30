import { expect } from 'chai'
import { describe, it } from 'mocha'
import validator from '../../../../app/db/validations/phoneNumber'

describe('#parseValidPhoneNumber', () => {
  describe('correctly formatted phone number', () => {
    it('returns success tuple with unmodified number', () => {
      expect(validator.parseValidPhoneNumber('+14042023333')).to.eql({
        phoneNumber: '+14042023333',
        input: '+14042023333',
      })
    })
  })

  describe('when phone number contains extraneous characters', () => {
    // where extraneous characters = Set('-', '.', ' ', '(', '}', '"')
    it('strips all dashes, returns success tuple', () => {
      expect(validator.parseValidPhoneNumber('"+ 1- (404) 202.3333"')).to.eql({
        phoneNumber: '+14042023333',
        input: '"+ 1- (404) 202.3333"',
      })
    })
  })

  describe('when phone number is from a non-US country', () => {
    it('strips all dashes, returns success tuple', () => {
      expect(validator.parseValidPhoneNumber('"+221 70 111 11 11"')).to.eql({
        phoneNumber: '+221701111111',
        input: '"+221 70 111 11 11"',
      })
    })
  })

  describe('when phone number is too short', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('+1404')).to.eql({
        phoneNumber: null,
        input: '+1404',
      })
    })
  })

  describe('when phone number is too long', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('+1234567890123456')).to.eql({
        phoneNumber: null,
        input: '+1234567890123456',
      })
    })
  })

  describe('when phone number lacks country code prefix', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('(404)-202.3333')).to.eql({
        phoneNumber: null,
        input: '(404)-202.3333',
      })
    })
  })

  describe('when phone number contains non-numeric digits', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('+1(foobar)')).to.eql({
        phoneNumber: null,
        input: '+1(foobar)',
      })
    })
  })
})
