const { isArray, mergeWith } = require('lodash')

const MY = require('./MY')
const SW = require('./SW')
const zhCN = require('./ZH-CN')

const EN = {
  ACCEPT: ['ACCEPT'],
  ADD: ['ADD'],
  BAN: ['BAN'],
  BROADCAST: ['BROADCAST', '!'],
  CHANNEL: ['CHANNEL'],
  DECLINE: ['DECLINE'],
  DESTROY: ['DESTROY'],
  DESTROY_CONFIRM: ['CONFIRM DESTROY'],
  HELP: ['HELP'],
  HOTLINE_ON: ['HOTLINE ON'],
  HOTLINE_OFF: ['HOTLINE OFF'],
  INFO: ['INFO'],
  INVITE: ['INVITE'],
  JOIN: ['HELLO', 'JOIN'], // we recognize "JOIN" and "LEAVE" for backwards compatibility
  LEAVE: ['GOODBYE', 'LEAVE', 'STOP', 'UNSUBSCRIBE'],
  PRIVATE: ['PRIVATE', '~'],
  REMOVE: ['REMOVE'],
  REPLY: ['REPLY', '@'],
  REQUEST: ['REQUEST'],
  RESTART: ['BOOST RESTART'],
  SET_LANGUAGE: ['ENGLISH', 'INGLÉS', 'INGLES', 'ANGLAIS', 'ENGLISCH'],
  VOUCH_LEVEL: ['VOUCH LEVEL', 'VOUCHING LEVEL'],
  VOUCHING_ON: ['VOUCHING ON'],
  VOUCHING_OFF: ['VOUCHING OFF'],
  VOUCHING_ADMIN: ['VOUCHING ADMIN'],
}

const mergeLang = (langA, langB) =>
  mergeWith(langA, langB, (a, b) => (isArray(a) ? a.concat(b) : a))
const mergeLangs = langs => langs.slice(1).reduce((acc, lang) => mergeLang(acc, lang), langs[0])

// export an EN commands module with MY and yueCN variants merged into the command strings arrays for each command:
module.exports = mergeLangs([EN, MY, SW, zhCN])
