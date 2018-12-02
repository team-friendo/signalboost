import { times, random }  from 'lodash'

export const phoneNumberFactory = () =>
  '+1' + times(10, () => random(0, 9).toString()).join('')
