package info.signalboost.signalc.model

import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.beInstanceOf
import kotlinx.serialization.SerializationException

class SocketRequestTest : FreeSpec({
    val senderNumber = genPhoneNumber()
    fun String.flatten() = this.trimMargin().replace("\n", "")

    "serialization" - {

        "SEND command" - {
            val recipientAddress = SocketAddress(
                number = genPhoneNumber(),
                uuid = genUuidStr(),
            )
            val body = genPhrase()

            val model = SocketRequest.Send(
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
                SocketRequest.fromJson(json) shouldBe model
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

            val model = SocketRequest.Subscribe(senderNumber)

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
                SocketRequest.fromJson(json) shouldBe model
            }
        }


        "invalid input" - {

            "bad JSON" - {
                val json = """{"type":"foo"}"""
                val err = SocketRequest.fromJson(json) as SocketRequest.ParseError

                "returns parse error"  {
                    err.cause should beInstanceOf<SerializationException>()
                    err.cause.message shouldContain "Polymorphic serializer was not found for class discriminator 'foo'"
                    err.input shouldBe json
                }
            }

            "not JSON" - {
                val str = "foo"
                val err = SocketRequest.fromJson(str) as SocketRequest.ParseError

                "returns parse error" {
                    err.cause should beInstanceOf<SerializationException>()
                    err.cause.message shouldContain "Expected class kotlinx.serialization.json.JsonObject as the serialized body"
                    err.input shouldBe str
                }
            }
        }


        "special commands" - {
            "CLOSE" - {
                val model = SocketRequest.Close
                val json = """{"type":"close"}"""

                "decodes from JSON" {
                    SocketRequest.fromJson(json) shouldBe model
                }

                "encodes to JSON" {
                    model.toJson() shouldBe json
                }
            }

            "ABORT" - {
                val model = SocketRequest.Abort
                val json = """{"type":"abort"}"""

                "decodes from JSON" {
                    SocketRequest.fromJson(json) shouldBe model
                }

                "encodes to JSON" {
                    model.toJson() shouldBe json
                }
            }

        }
    }
})
