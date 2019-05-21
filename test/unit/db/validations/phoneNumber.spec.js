import { expect } from 'chai'
import { describe, it } from 'mocha'
import validator from '../../../../app/db/validations/phoneNumber'

describe('#parseValidPhoneNumber', () => {
  describe('when phone number is valid', () => {
    it('strips all dashes/parentheses/dots from phone number, returns success tuple', () => {
      expect(validator.parseValidPhoneNumber('+1(404)-202.3333')).to.eql({
        isValid: true,
        phoneNumber: '+14042023333',
      })
    })
  })

  describe('when phone number is too short', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('+1404')).to.eql({
        isValid: false,
        phoneNumber: '+1404',
      })
    })
  })

  describe('when phone number is too long', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('+1234567890123456')).to.eql({
        isValid: false,
        phoneNumber: '+1234567890123456',
      })
    })
  })

  describe('when phone number lacks country code prefix', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('(404)-202.3333')).to.eql({
        isValid: false,
        phoneNumber: '4042023333',
      })
    })
  })

  describe('when phone number contains non-numeric digits', () => {
    it('returns invalid tuple', () => {
      expect(validator.parseValidPhoneNumber('+1(foobar)')).to.eql({
        isValid: false,
        phoneNumber: '+1foobar',
      })
    })
  })
})
