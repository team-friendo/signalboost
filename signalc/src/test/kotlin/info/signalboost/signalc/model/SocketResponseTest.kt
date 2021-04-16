package info.signalboost.signalc.model

import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalcAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSetExpiration
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genAbortWarning
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genCleartext
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genDecryptionError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genIsAliveResponse
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genInboundIdentityFailure
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genRegistrationError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genRegistrationSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genRequestHandlingError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genRequestInvalidError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSendResults
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSetExpirationFailed
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSetExpirationSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSubscriptionDisrupted
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSubscriptionFailed
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSubscriptionSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genTrustSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVerificationError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVerificationSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVersionResponse
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genPhrase
import info.signalboost.signalc.util.KeyUtil
import info.signalboost.signalc.util.TimeUtil.nowInMillis
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beOfType
import org.whispersystems.signalservice.api.messages.SendMessageResult

class SocketResponseTest : FreeSpec({
    val requestId = genUuidStr()
    fun String.flatten() = this.trimMargin().replace("\n", "")

    "factory methods" - {
        "for Cleartext" - {
            "constructs a Cleartext from a message and metadata" {
                SocketResponse.Cleartext.of(
                    sender = genSignalcAddress(),
                    recipient = genSignalcAddress(),
                    body = genPhrase(),
                    attachments = emptyList(),
                    expiresInSeconds = genInt(),
                    timestamp = nowInMillis()
                ) should beOfType<SocketResponse.Cleartext>()
            }
        }

        "for SendResult" - {
            val request = genSendRequest()
            val recipientAddress = request.recipientAddress
            val recipientSignalAddress = recipientAddress.asSignalServiceAddress()

            "constructs a SendResult from a SUCCESS" {
                SocketResponse.SendResult.of(
                    request,
                    SendMessageResult.success(recipientSignalAddress, false, true, 1)
                ) shouldBe SocketResponse.SendResult(
                    address = recipientAddress,
                    success = SocketResponse.SendResult.Success()
                )
            }

            "constructs a SendResult from a IDENTITY_FAILURE" {
                val newIdentityKey = KeyUtil.genIdentityKeyPair().publicKey

                SocketResponse.SendResult.of(
                    request,
                    SendMessageResult.identityFailure(
                        recipientSignalAddress,
                        newIdentityKey
                    )
                ) shouldBe SocketResponse.SendResult(
                    address = recipientAddress,
                    identityFailure = newIdentityKey.fingerprint
                )
            }

            "constructs a SendResult from an  NETWORK_FAILURE" {
                SocketResponse.SendResult.of(
                    request,
                    SendMessageResult.networkFailure(recipientSignalAddress)
                ) shouldBe SocketResponse.SendResult(
                    address = recipientAddress,
                    networkFailure = true
                )
            }

            "constructs a SendResult from an  UNREGISTERED_FAILURE" {
                SocketResponse.SendResult.of(
                    request,
                    SendMessageResult.unregisteredFailure(recipientSignalAddress)
                ) shouldBe SocketResponse.SendResult(
                    address = recipientAddress,
                    unregisteredFailure = true
                )
            }
        }
    }

    "serialization" - {
        "of AbortWarning" - {
            val response = genAbortWarning()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"abort_warning",
                  |"id":"${response.id}",
                  |"socketHash":${response.socketHash}
                |}
                """.flatten()
            }
        }

        "of Cleartext" - {
            // TODO: modify to match signald
            val response = genCleartext()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"message",
                  |"data":{
                    |"username":"${response.data.username}",
                    |"source":{
                      |"number":"${response.data.source.number}",
                      |"uuid":"${response.data.source.uuid}"
                    |},
                    |"dataMessage":{
                      |"body":"${response.data.dataMessage.body}",
                      |"expiresInSeconds":${response.data.dataMessage.expiresInSeconds},
                      |"timestamp":${response.data.dataMessage.timestamp},
                      |"attachments":[
                        |{
                          |"blurHash":null,
                          |"caption":null,
                          |"contentType":"${response.data.dataMessage.attachments[0].contentType}",
                          |"digest":null,
                          |"filename":"${response.data.dataMessage.attachments[0].filename}",
                          |"height":${response.data.dataMessage.attachments[0].height},
                          |"id":"${response.data.dataMessage.attachments[0].id}",
                          |"key":"${response.data.dataMessage.attachments[0].key}",
                          |"size":null,
                          |"width":${response.data.dataMessage.attachments[0].width},
                          |"voiceNote":false
                        |},
                        |{
                          |"blurHash":null,
                          |"caption":null,
                          |"contentType":"${response.data.dataMessage.attachments[1].contentType}",
                          |"digest":null,
                          |"filename":"${response.data.dataMessage.attachments[1].filename}",
                          |"height":${response.data.dataMessage.attachments[1].height},
                          |"id":"${response.data.dataMessage.attachments[1].id}",
                          |"key":"${response.data.dataMessage.attachments[1].key}",
                          |"size":null,
                          |"width":${response.data.dataMessage.attachments[1].width},
                          |"voiceNote":false
                        |}
                      |]
                    |}
                  |}
                |}""".flatten()
            }
        }

        "of DecryptionError" - {
            val response = genDecryptionError()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                   |"type":"decryption_error",
                   |"sender":{
                      |"number":"${response.sender.number}",
                      |"uuid":"${response.sender.uuid}"
                   |},
                   |"recipient":{
                      |"number":"${response.recipient.number}",
                      |"uuid":"${response.recipient.uuid}"
                   |},
                   |"error":{
                      |"cause":"${response.error.javaClass.name}",
                      |"message":"${response.error.message}"
                   |}
                |}""".flatten()
            }
        }

        "of IsAlive" - {
            val response = genIsAliveResponse()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                   |"type":"is_alive",
                   |"id":"${response.id}"
                |}""".flatten()
            }
        }

        "of InboundIdentityFailure" - {
            val response = genInboundIdentityFailure()
            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"inbound_identity_failure",
                  |"data":{
                    |"local_address":{
                      |"number":"${response.data.local_address.number}"
                    |},
                    |"remote_address":{
                      |"number":"${response.data.remote_address.number}"
                    |},
                    |"fingerprint":"${response.data.fingerprint}"
                  |}
                |}
                """.flatten()
            }
        }

        "of RegistrationSuccess" - {
            val response = genRegistrationSuccess()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                   |"type":"registration_succeeded",
                   |"id":"${response.id}",
                   |"data":{
                      |"username":"${response.data.username}"
                   |}
                |}""".flatten()
            }
        }

        "of RegistrationError" - {
            val response = genRegistrationError()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                   |"type":"registration_error",
                   |"id":"${response.id}",
                   |"data":{
                      |"username":"${response.data.username}"
                   |},
                   |"error":{
                      |"cause":"${response.error.javaClass.name}",
                      |"message":"${response.error.message}"
                   |}
                |}""".flatten()
            }
        }

        "of RequestHandlingException" - {
            val response = genRequestHandlingError(
                id = requestId,
                request = SocketRequest.Abort(requestId),
            )

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                   |"type":"unexpected_error",
                   |"id":"$requestId",
                   |"error":{
                      |"cause":"${response.error.javaClass.name}",
                      |"message":"${response.error.message}"
                   |},
                   |"request":{"type":"abort","id":"$requestId"}
                |}""".flatten()
            }
        }

        "of RequestInvalidException" - {
            val response = genRequestInvalidError()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                   |"type":"request_invalid",
                   |"error":{
                      |"cause":"${response.error.javaClass.name}",
                      |"message":"${response.error.message}"
                   |},
                   |"request":"${response.request}"
                |}""".flatten()
            }
        }

        "of SendResults" - {
            "of type SUCCESS" - {
                val response = genSendResults(type = SendResultType.SUCCESS)

                "encodes JSON" {
                    response.toJson() shouldBe """
                    |{
                       |"type":"send_results",
                       |"id":"${response.id}",
                       |"data":[{
                         |"address":{
                           |"number":"${response.data[0].address.number}",
                           |"uuid":"${response.data[0].address.uuid}"
                         |},
                         |"success":{
                           |"unidentified":false,
                           |"needsSync":true
                         |},
                         |"identityFailure":null,
                         |"networkFailure":false,
                         |"unregisteredFailure":false,
                         |"unknownError":false
                       |}]
                    |}""".flatten()
                }
            }

            "of type IDENTITY_FAILURE" - {
                val response = genSendResults(type = SendResultType.IDENTITY_FAILURE)

                "encodes JSON" {
                    response.toJson() shouldBe """
                    |{
                       |"type":"send_results",
                       |"id":"${response.id}",
                       |"data":[{
                         |"address":{
                           |"number":"${response.data[0].address.number}",
                           |"uuid":"${response.data[0].address.uuid}"
                         |},
                         |"success":null,
                         |"identityFailure":"${response.data[0].identityFailure}",
                         |"networkFailure":false,
                         |"unregisteredFailure":false,
                         |"unknownError":false
                       |}]
                    |}""".flatten()
                }
            }

            "of type NETWORK_ERROR" - {
                val response = genSendResults(type = SendResultType.NETWORK_FAILURE)

                "encodes JSON" {
                    response.toJson() shouldBe """
                    |{
                       |"type":"send_results",
                       |"id":"${response.id}",
                       |"data":[{
                         |"address":{
                           |"number":"${response.data[0].address.number}",
                           |"uuid":"${response.data[0].address.uuid}"
                         |},
                         |"success":null,
                         |"identityFailure":null,
                         |"networkFailure":true,
                         |"unregisteredFailure":false,
                         |"unknownError":false
                       |}]
                    |}""".flatten()
                }
            }

            "of type UNREGISTERED_FAILURE" - {
                val response = genSendResults(type = SendResultType.UNREGISTERED_FAILURE)

                "encodes JSON" {
                    response.toJson() shouldBe """
                    |{
                       |"type":"send_results",
                       |"id":"${response.id}",
                       |"data":[{
                         |"address":{
                           |"number":"${response.data[0].address.number}",
                           |"uuid":"${response.data[0].address.uuid}"
                         |},
                         |"success":null,
                         |"identityFailure":null,
                         |"networkFailure":false,
                         |"unregisteredFailure":true,
                         |"unknownError":false
                       |}]
                    |}""".flatten()
                }
            }

            "of type UNKNOWN_ERROR" - {
                val response = genSendResults(type = SendResultType.UNKNOWN_ERROR)

                "encodes JSON" {
                    response.toJson() shouldBe """
                    |{
                       |"type":"send_results",
                       |"id":"${response.id}",
                       |"data":[{
                         |"address":{
                           |"number":"${response.data[0].address.number}",
                           |"uuid":"${response.data[0].address.uuid}"
                         |},
                         |"success":null,
                         |"identityFailure":null,
                         |"networkFailure":false,
                         |"unregisteredFailure":false,
                         |"unknownError":true
                       |}]
                    |}""".flatten()
                }
            }
        }

        "of SetExpirationFailed" - {
            val response = genSetExpirationFailed()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"set_expiration_failed",
                  |"id":"${response.id}",
                  |"username":"${response.username}",
                  |"recipientAddress":{
                    |"number":"${response.recipientAddress.number}",
                    |"uuid":"${response.recipientAddress.uuid}"
                  |},
                  |"resultType":"NETWORK_FAILURE"
                |}
                """.flatten()
            }
        }


        "of SetExpirationSuccess" - {
            val response = genSetExpirationSuccess()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"set_expiration_succeeded",
                  |"id":"${response.id}",
                  |"username":"${response.username}",
                  |"recipientAddress":{
                    |"number":"${response.recipientAddress.number}",
                    |"uuid":"${response.recipientAddress.uuid}"
                  |}
                |}
                """.flatten()
            }
        }

        "of SubscriptionSuccess" - {
            val response = genSubscriptionSuccess()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"subscription_succeeded",
                  |"id":"${response.id}",
                  |"username":"${response.username}"
                |}
                """.flatten()
            }
        }


        "of SubscriptionFailed" - {
            val response = genSubscriptionFailed()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"subscription_failed",
                  |"id":"${response.id}",
                  |"error":{
                    |"cause":"${response.error.javaClass.name}",
                    |"message":"${response.error.message}"
                  |}
                |}
                """.flatten()
            }
        }

        "of SubscriptionDisrupted" - {
            val response = genSubscriptionDisrupted()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"subscription_disrupted",
                  |"id":"${response.id}",
                  |"error":{
                    |"cause":"${response.error.javaClass.name}",
                    |"message":"${response.error.message}"
                  |}
                |}
                """.flatten()
            }
        }

        "of TrustSuccess" - {
            val response = genTrustSuccess()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"trusted_fingerprint",
                  |"id":"${response.id}",
                  |"data":{
                    |"message":"${response.data.message}",
                    |"request":{
                      |"id":"${response.data.request.id}",
                      |"username":"${response.data.request.username}",
                      |"recipientAddress":{
                        |"number":"${response.data.request.recipientAddress.number}",
                        |"uuid":"${response.data.request.recipientAddress.uuid}"
                      |},
                      |"fingerprint":"${response.data.request.fingerprint}"
                    |}
                  |}
                |}
                """.flatten()
            }
        }

        "of VerificationSuccess" - {
            val response = genVerificationSuccess()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"verification_succeeded",
                  |"id":"${response.id}",
                  |"data":{
                    |"username":"${response.data.username}"
                  |}
                |}
                """.flatten()
            }
        }

        "of VerificationError" - {
            val response = genVerificationError()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"verification_error",
                  |"id":"${response.id}",
                  |"data":{
                    |"username":"${response.data.username}"
                  |},
                  |"error":{
                    |"cause":"java.lang.Error",
                    |"message":"${response.error.message}"
                  |}
                |}
                """.flatten()
            }
        }

        "of Version" - {
            val response = genVersionResponse()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"version",
                  |"id":"${response.id}",
                  |"data":{
                    |"version":"${response.data.version}"
                  |}
                |}
                """.flatten()
            }
        }
    }
})
