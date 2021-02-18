package info.signalboost.signalc.model

import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genCleartext
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genDecryptionException
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genRequestHandlingException
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genRequestInvalidException
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSendException
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSendSuccess
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genShutdown
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSubscriptionDisrupted
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genSubscriptionFailed
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.shouldThrowLike
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe

class SocketResponseTest : FreeSpec({
    fun String.flatten() = this.trimMargin().replace("\n", "")

    "serialization" - {

        "of Cleartext" - {
            // TODO: modify to match signald
            val model = genCleartext()
            val json = """
            |{
               |"type":"message",
               |"sender":{
                  |"number":"${model.sender.number}",
                  |"uuid":"${model.sender.uuid}"
               |},
               |"recipient":{
                  |"number":"${model.recipient.number}",
                  |"uuid":"${model.recipient.uuid}"
               |},
               |"body":"${model.body}",
               |"attachments":[]
            |}""".flatten()

            "decodes from JSON" {
                SocketResponse.fromJson(json) shouldBe model
            }

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

        "of DecryptionError" - {
            val model = genDecryptionException()
            val json = """
            |{
               |"type":"decryptionError",
               |"sender":{
                  |"number":"${model.sender.number}",
                  |"uuid":"${model.sender.uuid}"
               |},
               |"recipient":{
                  |"number":"${model.recipient.number}",
                  |"uuid":"${model.recipient.uuid}"
               |},
               |"error":{
                  |"cause":"${model.error.javaClass.name}",
                  |"message":"${model.error.message}"
               |}
            |}""".flatten()

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }
        "of RequestHandlingException" - {
            val model = genRequestHandlingException(
                request = SocketRequest.Abort
            )
            val json = """
            |{
               |"type":"error",
               |"error":{
                  |"cause":"${model.error.javaClass.name}",
                  |"message":"${model.error.message}"
               |},
               |"request":{"type":"abort"}
            |}""".flatten()

            "decodes from JSON" {
                (SocketResponse.fromJson(json) as SocketResponse.RequestHandlingException)
                    .shouldThrowLike(model)
            }

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

        "of RequestInvalidException" - {
            val model = genRequestInvalidException()
            val json = """
            |{
               |"type":"invalid",
               |"error":{
                  |"cause":"${model.error.javaClass.name}",
                  |"message":"${model.error.message}"
               |},
               |"request":"${model.request}"
            |}""".flatten()

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

        "of SendSuccess" - {
            val model = genSendSuccess()
            val json = """
            |{"type":"sendSuccess"}
            """.flatten()

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

        "of SendException" - {
            val model = genSendException()
            val json = """
            |{"type":"sendError"}
            """.flatten()

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

        "of SubscriptionFailed" - {
            val model = genSubscriptionFailed()
            val json = """
            |{
              |"type":"subscriptionFailed",
              |"error":{
                |"cause":"${model.error.javaClass.name}",
                |"message":"${model.error.message}"
              |}
            |}
            """.flatten()

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

        "of SubscriptionDisrupted" - {
            val model = genSubscriptionDisrupted()
            val json = """
            |{
              |"type":"subscriptionDisrupted",
              |"error":{
                |"cause":"${model.error.javaClass.name}",
                |"message":"${model.error.message}"
              |}
            |}
            """.flatten()

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

        "of Shutdown" - {
            val model = genShutdown()
            val json = """
            |{
              |"type":"shutdown",
              |"socketHash":${model.socketHash}
            |}
            """.flatten()

            "encodes to JSON" {
                model.toJson() shouldBe json
            }
        }

    }
})
