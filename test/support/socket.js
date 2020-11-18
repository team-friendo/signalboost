import { flatMap } from 'lodash'

export const getSentMessages = writeStub =>
  flatMap(writeStub.getCalls(), call => call.args[0]).filter(
    msg => !(msg.messageBody || '').includes('healthcheck'),
  )
