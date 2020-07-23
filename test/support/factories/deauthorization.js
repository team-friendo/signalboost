import { genPhoneNumber } from './phoneNumber'
import { shuffle, times, random } from 'lodash'

export const genFingerprint = () =>
  shuffle([
    '05',
    '6b',
    'c5',
    '19',
    'fc',
    'aa',
    '44',
    '57',
    '3f',
    '2d',
    '2e',
    '39',
    'c7',
    '73',
    'a4',
    '13',
    '6a',
    '51',
    '3d',
    '95',
    '33',
    '08',
    '9b',
    'd3',
    '32',
    '84',
    '01',
    '99',
    '4d',
    'ae',
    '63',
    '8c',
    '6f',
  ]).join(' ') + ' '

export const genSafetyNumber = () => times(60, () => random(0, 9)).join('')

export const deauthorizationFactory = attrs => ({
  channelPhoneNumber: genPhoneNumber(),
  memberPhoneNumber: genPhoneNumber(),
  fingerprint: genFingerprint(),
  ...attrs,
})
