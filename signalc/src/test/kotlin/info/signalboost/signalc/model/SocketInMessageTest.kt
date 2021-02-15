package info.signalboost.signalc.model

import info.signalboost.signalc.testSupport.fixtures.Address.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.Address.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.SocketOutMessage.genPhrase
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beInstanceOf
import kotlinx.serialization.SerializationException

class SocketInMessageTest : FreeSpec({
    val senderNumber = genPhoneNumber()
    fun String.flatten() = this.trimMargin().replace("\n", "")

    "serialization" - {

        "SEND command" - {
            val recipientAddress = SocketAddress(
                number = genPhoneNumber(),
                uuid = genUuidStr(),
            )
            val body = genPhrase()

            val model = SocketInMessage.Send(
                username =  senderNumber,
                recipientAddress = recipientAddress,
                messageBody = body,
                attachments = emptyList(),
            )

            val json = """
            |{
               |"type":"send",
               |"username":"$senderNumber",
               |"recipientAddress":{
                  |"number":"${recipientAddress.number}",
                  |"uuid":"${recipientAddress.uuid}"
               |},
               |"messageBody":"$body",
               |"attachments":[]
            |}
        """.flatten()


            "decodes from JSON" {
                SocketInMessage.fromJson(json) shouldBe model
            }

            "encodes to JSON" {
                model.toJson() shouldBe json
            }

            "encodes to JSON with null uuid field" {
                val model2 = model.copy(
                    recipientAddress = recipientAddress.copy(
                        uuid = null
                    )
                )
                model2.toJson() shouldBe
                        json.replace(""""${recipientAddress.uuid}"""", "null")
            }
        }

        "SUBSCRIBE command" - {

            val model = SocketInMessage.Subscribe(senderNumber)

            val json = """
                |{
                   |"type":"subscribe",
                   |"username":"$senderNumber"
                |}
            """.flatten()

            "decodes from JSON" {
                model.toJson() shouldBe json
            }

            "encodes to JSON" {
                SocketInMessage.fromJson(json) shouldBe model
            }
        }


        "invalid input" - {

            "bad JSON" - {
                val json = """{"type":"foo"}"""
                val err = SocketInMessage.fromJson(json) as SocketInMessage.ParseError

                "returns parse error"  {
                    err.cause should beInstanceOf<SerializationException>()
                    err.cause.message shouldBe """
                  Polymorphic serializer was not found for class discriminator 'foo'
                  JSON input: {"type":"foo"}
                """.trimIndent()
                    err.input shouldBe json
                }
            }

            "not JSON" - {
                val str = "foo"
                val err = SocketInMessage.fromJson(str) as SocketInMessage.ParseError

                "returns parse error" {
                    err.cause should beInstanceOf<SerializationException>()
                    err.cause.message shouldBe """
                  Expected class kotlinx.serialization.json.JsonObject as the serialized body of info.signalboost.signalc.model.SocketInMessage, but had class kotlinx.serialization.json.JsonLiteral
                """.trimIndent()
                    err.input shouldBe str
                }
            }
        }


        "special commands" - {
            "CLOSE" - {
                val model = SocketInMessage.Close
                val json = """{"type":"close"}"""

                "decodes from JSON" {
                    SocketInMessage.fromJson(json) shouldBe model
                }

                "encodes to JSON" {
                    model.toJson() shouldBe json
                }
            }

            "ABORT" - {
                val model = SocketInMessage.Abort
                val json = """{"type":"abort"}"""

                "decodes from JSON" {
                    SocketInMessage.fromJson(json) shouldBe model
                }

                "encodes to JSON" {
                    model.toJson() shouldBe json
                }
            }

        }
    }
})
