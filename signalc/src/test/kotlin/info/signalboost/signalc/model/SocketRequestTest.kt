package info.signalboost.signalc.model

import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genDeleteAccountRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genRegisterRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSetExpiration
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genTrustRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genUnsubscribeRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genVerifyRequest
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

        "DELETE_ACCOUNT request" - {
            val request = genDeleteAccountRequest()
            "decodes from JSON" {
                SocketRequest.fromJson(
                    """{"type":"delete_account","id":"${request.id}","username":"${request.username}"}"""
                ) shouldBe SocketRequest.DeleteAccount(request.id, request.username)
            }
        }

        "IS_ALIVE request" - {
            "decodes from JSON" {
                SocketRequest.fromJson(
                    """{"type":"is_alive","id":"$requestId"}"""
                ) shouldBe SocketRequest.IsAlive(requestId)
            }
        }

        "REGISTER request" - {

            "with all fields present" - {
                val request = genRegisterRequest()

                "decodes from JSON" {
                    val json = """
                    |{
                      |"id":"${request.id}",
                      |"type":"register",
                      |"username":"${request.username}",
                      |"captcha":"${request.captcha}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }

            "with missing captcha token" - {
                val request = genRegisterRequest(captcha = null)

                "decodes from JSON" {
                    val json = """
                    |{
                      |"id":"${request.id}",
                      |"type":"register",
                      |"username":"${request.username}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }

            "with missing id" - {
                val request = genRegisterRequest(id = generatedUuid)

                "decodes from JSON" {
                    val json = """
                    |{
                      |"type":"register",
                      |"username":"${request.username}",
                      |"captcha":"${request.captcha}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }
        }

        "SEND request" - {
            val request = genSendRequest()
            val requestWithNullId = request.copy(
                recipientAddress = request.recipientAddress.copy(
                    uuid = null
                )
            )

            "decodes from JSON" {
                val json = """
                |{
                  |"type":"send",
                  |"id":"${request.id}",
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
                   |"id":"${request.id}",
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
                   |"id":"${request.id}",
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
            val request = genSetExpiration()

            "decodes from JSON" {
                val json = """
                |{
                  |"type":"set_expiration",
                  |"id":"${request.id}",
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
            val request = genSubscribeRequest()

            "decodes from JSON" {
                val json = """
                |{
                   |"type":"subscribe",
                   |"id":"${request.id}",
                   |"username":"${request.username}"
                |}""".flatten()

                SocketRequest.fromJson(json) shouldBe request
            }
        }

        "TRUST request" - {
            val request = genTrustRequest()

            "decodes JSON" {
                val json = """
                |{
                  |"type":"trust",
                  |"id":"${request.id}",
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
            val request = genUnsubscribeRequest()

            "decodes from JSON" {
                val json = """
                |{
                   |"type":"unsubscribe",
                   |"id":"${request.id}",
                   |"username":"${request.username}"
                |}""".flatten()

                SocketRequest.fromJson(json) shouldBe request
            }
        }

        "VERIFY request" - {
            "with all fields" - {
                val request = genVerifyRequest()

                "decodes from JSON" {
                    val json = """
                    |{
                       |"type":"verify",
                       |"id":"${request.id}",
                       |"username":"${request.username}",
                       |"code":"${request.code}"
                    |}""".flatten()

                    SocketRequest.fromJson(json) shouldBe request
                }
            }

            "with missing id field" - {
                val request = genVerifyRequest(id = generatedUuid,)

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
