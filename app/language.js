const { parsePhoneNumberFromString } = require('libphonenumber-js')

const languages = {
  EN: 'EN',
  ES: 'ES',
  FR: 'FR',
  DE: 'DE',
}

const defaultLanguage = process.env.DEFAULT_LANGUAGE || languages.EN

// string -> string
const languageForPhoneNumber = phoneNumber =>
  languageForCountry(parsePhoneNumberFromString(phoneNumber).country)

// string -> string
const languageForCountry = country => {
  // NOTE: many countries are not handled!
  switch (country) {
    // spanish-speaking countries
    case 'AR': // argentina
    case 'BO': // bolivia
    case 'CL': // chile
    case 'CO': // columbia
    case 'CR': // costa rica
    case 'CU': // cuba
    case 'DO': // dominican republic
    case 'EC': // ecuador
    case 'ES': // spain
    case 'GT': // guatemala
    case 'GY': // guyana
    case 'HN': // honduras
    case 'MX': // mexico
    case 'NI': // nicaragua
    case 'PA': // panama
    case 'PY': // paraguay
    case 'PE': // peru
    case 'SV': // el salvador
    case 'UY': // uruguay
    case 'VE': // venezuela
      return languages.ES

    // english-speaking countreies
    case 'AU': // australia
    case 'BW': // botswana
    case 'BZ': // belize
    case 'CA': // canada
    case 'GB': // united kingdom
    case 'GH': // ghana
    case 'KE': // kenya
    case 'MW': // malawi
    case 'NG': // nigeria
    case 'NL': // netherlands (TODO: support dutch!)
    case 'NZ': // new zealand
    case 'RW': // rwanda
    case 'SD': // sudan
    case 'UG': // uganda
    case 'US': // usa
    case 'ZA': // south africa
    case 'ZM': // zambia
    case 'ZW': // zimbabwe
      return languages.EN

    // french-speaking countries
    case 'BE': // belgium
    case 'BF': // burkina faso
    case 'CG': // congo
    case 'CD': // democratic republic of congo
    case 'CI': // cote d'ivoire
    case 'CM': // cameroon
    case 'DZ': // algeria
    case 'FR': // france
    case 'GA': // gabon
    case 'GF': // french guyana
    case 'HT': // haiti
    case 'LU': // luxembourg
    case 'MR': // mauritania
    case 'MZ': // morocco
    case 'NE': // niger
    case 'SN': // senegal
    case 'TD': // chad
    case 'TG': // togo
    case 'TN': // tunisia
      return languages.FR

    // german-speaking countries
    case 'AT': // austria
    case 'CH': // switzerland
    case 'DE': // germany
    case 'LI': // liechtenstein
      return languages.DE

    // default to whatever this server's default lang is
    default:
      return defaultLanguage
  }
}

module.exports = { languages, defaultLanguage, languageForPhoneNumber, languageForCountry }
