import { describe, it } from 'mocha'
import { expect } from 'chai'
import {
  languages,
  defaultLanguage,
  languageForPhoneNumber,
  languageForCountry,
} from '../../../app/services/language'

describe('langauge module', () => {
  describe('supported languages', () => {
    it('includes EN, ES, DE, FR', () => {
      expect(Object.keys(languages)).to.have.members(['EN', 'ES', 'DE', 'FR'])
    })
  })

  describe('#languageForPhoneNumber', () => {
    it("returns the language corresponding to the number's country code", () => {
      const variants = [
        {
          language: languages.EN,
          phoneNumbers: [
            '+15123334444', // turtle island
            '+31640000000', // netherlands
            '+447500000000', // uk
            '+642100000000', // new zealand
          ],
        },
        {
          language: languages.ES,
          phoneNumbers: [
            '+34620000000', // spain
            '+524400000000', // mexico
          ],
        },
        {
          language: languages.FR,
          phoneNumbers: [
            '+32494000000', // france
            '+33760000000', // belgium
            '+22170333333', // senegal
          ],
        },
        {
          language: languages.DE,
          phoneNumbers: [
            '+41760000000', // switzerland
            '+436500000000', // austria
            '+4915000000000', // germany
          ],
        },
        {
          language: defaultLanguage,
          phoneNumbers: [
            '+48510000000', // poland
            '+918308841861', // india
          ],
        },
      ]
      variants.forEach(({ language, phoneNumbers }) => {
        phoneNumbers.forEach(phoneNumber => {
          expect(languageForPhoneNumber(phoneNumber)).to.eql(language)
        })
      })
    })
  })

  describe('#languageForCountry', () => {
    it('returns the langauge corresponding to an iso2 country code', () => {
      const variants = [
        {
          language: languages.EN,
          countryCodes: [
            'AU', // australia
            'BW', // botswana
            'BZ', // belize
            'CA', // canada
            'GB', // united kingdom
            'GH', // ghana
            'KE', // kenya
            'MW', // malawi
            'NG', // nigeria
            'NL', // netherlands
            'NZ', // new zealand
            'RW', // rwanda
            'SD', // sudan
            'UG', // uganda
            'US', // usa
            'ZA', // south africa
            'ZM', // zambia
            'ZW', // zimbabwe
          ],
        },
        {
          language: languages.ES,
          countryCodes: [
            'AR', // argentina
            'BO', // bolivia
            'CL', // chile
            'CO', // columbia
            'CR', // costa rica
            'CU', // cuba
            'DO', // dominican republic
            'EC', // ecuador
            'ES', // spain
            'GT', // guatemala
            'GY', // guyana
            'HN', // honduras
            'MX', // mexico
            'NI', // nicaragua
            'PA', // panama
            'PY', // paraguay
            'PE', // peru
            'SV', // el salvador
            'UY', // uruguay
            'VE', // venezuela
          ],
        },
        {
          language: languages.FR,
          countryCodes: [
            'BE', // belgium
            'BF', // burkina faso
            'CG', // congo
            'CD', // democratic republic of congo
            'CI', // cote d'ivoire
            'CM', // cameroon
            'DZ', // algeria
            'FR', // france
            'GA', // gabon
            'GF', // french guyana
            'HT', // haiti
            'LU', // luxembourg
            'MR', // mauritania
            'MZ', // morocco
            'NE', // niger
            'SN', // senegal
            'TD', // chad
            'TG', // togo
            'TN', // tunisia
          ],
        },
        {
          language: languages.DE,
          countryCodes: [
            'AT', // austria
            'CH', // switzerland
            'DE', // germany
            'LI', // liechtenstein
          ],
        },
        {
          language: defaultLanguage,
          countryCodes: ['IN', 'IR', 'PL', 'HU'],
        },
      ]
      variants.forEach(({ language, countryCodes }) => {
        countryCodes.forEach(countryCode => {
          expect(languageForCountry(countryCode)).to.eql(language)
        })
      })
    })
  })
})
