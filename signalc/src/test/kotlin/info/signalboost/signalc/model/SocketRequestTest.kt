package info.signalboost.signalc.model

import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSerializableAddress
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.NumGen.genInt
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genTrustRequest
import info.signalboost.signalc.testSupport.fixtures.StringGen.genCaptchaToken
import info.signalboost.signalc.testSupport.fixtures.StringGen.genFingerprint
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase
import info.signalboost.signalc.testSupport.fixtures.StringGen.genVerificationCode
import info.signalboost.signalc.util.KeyUtil
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.beInstanceOf
import io.mockk.every
import io.mockk.mockkObject
import io.mockk.unmockkAll
import kotlinx.serialization.SerializationException

class SocketRequestTest : FreeSpec({
    val senderNumber = genPhoneNumber()
    val requestId = genUuidStr()
    val generatedUuid = genUuidStr()

    fun String.flatten() = this.trimMargin().replace("\n", "")

    beforeSpec {
        mockkObject(KeyUtil)
        every { KeyUtil.genUuidStr() } returns generatedUuid
    }

    afterSpec {
        unmockkAll()
    }

    "deserialization" - {

        "ABORT request" - {
            "decodes from JSON" {
                SocketRequest.fromJson(
                    """{"type":"abort","id":"$requestId"}"""
                ) shouldBe SocketRequest.Abort(requestId)
            }
        }

        "CLOSE request" - {
            "decodes from JSON" {
                SocketRequest.fromJson(
                    """{"type":"close","id":"$requestId"}"""
                ) shouldBe SocketRequest.Close(requestId)
            }
        }

        "REGISTER request" - {

            "with all fields present" - {
                val request = SocketRequest.Register(
                    id = requestId,
                    username = senderNumber,
                    captchaToken = genCaptchaToken(),
                )

                "decodes from JSON" {
                    val json = """
                    |{
                      |"id":"$requestId",
                      |"type":"register",
                      |"username":"${request.username}",
                      |"captchaToken":"${request.captchaToken}"              
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }

            "with missing captcha token" - {
                val request = SocketRequest.Register(
                    id = requestId,
                    username = senderNumber,
                )

                "decodes from JSON" {
                    val json = """
                    |{
                      |"id":"$requestId",
                      |"type":"register",
                      |"username":"${request.username}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }

            "with missing id" - {
                val request = SocketRequest.Register(
                    id = generatedUuid,
                    username = senderNumber,
                    captchaToken = genCaptchaToken(),
                )

                "decodes from JSON" {
                    val json = """
                    |{
                      |"type":"register",
                      |"username":"${request.username}",
                      |"captchaToken":"${request.captchaToken}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }
        }

        "SEND request" - {

            val request = SocketRequest.Send(
                id = requestId,
                username =  genPhoneNumber(),
                recipientAddress = genSerializableAddress(),
                messageBody = genPhrase(),
                attachments = emptyList(),
            )

            val requestWithNullId = request.copy(
                recipientAddress = request.recipientAddress.copy(
                    uuid = null
                )
            )

            "decodes from JSON" {
                val json = """
                |{
                  |"type":"send",
                  |"id":"$requestId",
                  |"username":"${request.username}",
                  |"recipientAddress":{
                    |"number":"${request.recipientAddress.number}",
                    |"uuid":"${request.recipientAddress.uuid}"
                  |},
                |"messageBody":"${request.messageBody}",
                |"attachments":[]
                |}""".flatten()

                SocketRequest.fromJson(json) shouldBe request
            }

            "decodes from JSON with missing uuid field" {
                val jsonWithNoUuid = """
                |{
                   |"type":"send",
                   |"id":"$requestId",
                   |"username":"${request.username}",
                   |"recipientAddress":{
                      |"number":"${request.recipientAddress.number}"
                   |},
                   |"messageBody":"${request.messageBody}",
                   |"attachments":[]
                |}""".flatten()

                SocketRequest.fromJson(jsonWithNoUuid) shouldBe requestWithNullId
            }

            "decodes from JSON with null uuid field" {
                val jsonWithNullUuid = """
                |{
                   |"type":"send",
                   |"id":"$requestId",
                   |"username":"${request.username}",
                   |"recipientAddress":{
                      |"number":"${request.recipientAddress.number}",
                      |"uuid":null
                   |},
                   |"messageBody":"${request.messageBody}",
                   |"attachments":[]
                |}""".flatten()

                SocketRequest.fromJson(jsonWithNullUuid) shouldBe requestWithNullId
            }

        }

        "SET EXPIRATION request" - {
            val request = SocketRequest.SetExpiration(
                id = requestId,
                username = senderNumber,
                recipientAddress = genSerializableAddress(),
                expiresInSeconds = genInt()
            )

            "decodes from JSON" {
                val json = """
                |{
                  |"type":"set_expiration",
                  |"id":"$requestId",
                  |"username":"${request.username}",
                  |"recipientAddress":{
                     |"number":"${request.recipientAddress.number}",
                     |"uuid":"${request.recipientAddress.uuid}"
                  |},
                  |"expiresInSeconds":"${request.expiresInSeconds}"
                |}""".flatten()

                SocketRequest.fromJson(json) shouldBe request
            }
        }

        "SUBSCRIBE request" - {
            val request = SocketRequest.Subscribe(
                requestId,
                senderNumber,
            )

            "decodes from JSON" {
                val json = """
                |{
                   |"type":"subscribe",
                   |"id":"$requestId",
                   |"username":"$senderNumber"
                |}""".flatten()

                SocketRequest.fromJson(json) shouldBe request
            }
        }

        "TRUST request" - {
            val request = genTrustRequest(
                id = requestId,
                username = senderNumber,
            )

            "decodes JSON" {
                val json = """
                |{
                  |"type":"trust",
                  |"id":"$requestId",
                  |"username":"${request.username}",
                  |"recipientAddress":{
                     |"number":"${request.recipientAddress.number}",
                     |"uuid":"${request.recipientAddress.uuid}"
                  |},
                  |"fingerprint":"${request.fingerprint}"
                |}""".flatten()

                SocketRequest.fromJson(json) shouldBe request
            }
        }

        "UNSUBSCRIBE request" - {
            val request = SocketRequest.Unsubscribe(
                id = requestId,
                username = senderNumber
            )

            "decodes from JSON" {
                val json = """
                |{
                   |"type":"unsubscribe",
                   |"id":"$requestId",
                   |"username":"$senderNumber"
                |}""".flatten()

                SocketRequest.fromJson(json) shouldBe request
            }
        }

        "VERIFY request" - {
            "with all fields" - {
                val request = SocketRequest.Verify(
                    id = requestId,
                    username = senderNumber,
                    code = genVerificationCode(),
                )

                "decodes from JSON" {
                    val json = """
                    |{
                       |"type":"verify",
                       |"id":"$requestId",
                       |"username":"${request.username}",
                       |"code":"${request.code}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }

            "with missing id field" - {
                val request = SocketRequest.Verify(
                    id = generatedUuid,
                    username = senderNumber,
                    code = genVerificationCode(),
                )

                "decodes from JSON and generates id field" {
                    val json = """
                    |{
                       |"type":"verify",
                       |"username":"${request.username}",
                       |"code":"${request.code}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }
        }

        "VERSION request" - {
            "decodes from JSON" {
                SocketRequest.fromJson(
                    """{"type":"version","id":"$requestId"}"""
                ) shouldBe SocketRequest.Version(requestId)
            }
        }


        "invalid requests" - {

            "bad JSON" - {
                val badJson = """{"type":"foo"}"""
                val err = SocketRequest.fromJson(badJson) as SocketRequest.ParseError

                "returns parse error"  {
                    err.error should beInstanceOf<SerializationException>()
                    err.error.message shouldContain "Polymorphic serializer was not found for class discriminator 'foo'"
                    err.input shouldBe badJson
                }
            }

            "not JSON" - {
                val notJson = "foo"
                val err = SocketRequest.fromJson(notJson) as SocketRequest.ParseError

                "returns parse error" {
                    err.error should beInstanceOf<SerializationException>()
                    err.error.message shouldContain "Expected class kotlinx.serialization.json.JsonObject as the serialized body"
                    err.input shouldBe notJson
                }
            }
        }
    }
})
