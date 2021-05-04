package info.signalboost.signalc

import info.signalboost.signalc.logic.MessageQueue
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beOfType
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import java.util.concurrent.atomic.AtomicInteger
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class ApplicationTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val app = Application(Config.test).run(testScope)

        afterSpec {
            app.stop()
            unmockkAll()
            testScope.teardown()
        }

        "#run" - {
            "initializes application resources" {
                app.coroutineScope
                app.accountStore
                app.protocolStore
                app.signal
            }

            "initializes all 'cold' application components" {
                app.signalReceiver
                app.signalSender
                app.socketReceiver
                app.socketSender
            }

            "initializes and runs all 'hot' application components" {
                app.socketServer.listenJob.isActive shouldBe true
                app.socketServer.socket.isClosed shouldBe false
            }
        }

        "#stop" - {
            // TODO: we could do some more interesting setup here to make the
            // below assertions about unsubscribing and draining prove something interesting...
            val res = app.stop()

            "closes down all 'hot' app components" {
                app.socketServer.listenJob.isActive shouldBe false
                app.socketServer.socket.isClosed shouldBe true
            }

            "unsubscribes from all incoming messages" {
                app.signalReceiver.messagePipeCount shouldBe 0
            }


            "drains signal receive and send message queues" {
                app.signalSender.messagesInFlight.get() shouldBe 0
                app.signalReceiver.messagesInFlight.get() shouldBe 0
            }

            "returns a reference to the application for restarting" {
                res should beOfType<Application>()
            }
        }
    }
})
