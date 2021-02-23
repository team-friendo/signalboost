package info.signalboost.signalc.model

import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSerializableAddress
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.NumGen.genInt
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genAbortWarning
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genCleartext
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genDecryptionError
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genRegistrationSuccess
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genRequestHandlingError
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genRequestInvalidException
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSendResults
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSubscriptionDisrupted
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSubscriptionFailed
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSubscriptionSuccess
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genTrustSuccess
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genVerificationError
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genVerificationSuccess
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genVersionResponse
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase
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
                    sender = genSerializableAddress(),
                    recipient = genSerializableAddress(),
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
            val recipientSignalAddress = recipientAddress.asSignalAddress()

            "constructs a SendResult from a SUCCESS" {
                SocketResponse.SendResult.of(
                    request,
                    SendMessageResult.success(recipientSignalAddress, false, true)
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
                      |"attachments":[]
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
            val response = genRequestInvalidException()

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
            val recipientAddress = genSerializableAddress()

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

        "of SubscriptionSuccess" - {
            val response = genSubscriptionSuccess()

            "encodes to JSON" {
                response.toJson() shouldBe """
                |{
                  |"type":"subscription_succeeded",
                  |"id":"${response.id}"
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

        "of TrustSucess" - {
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
