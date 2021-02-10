package info.signalboost.signalc

import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.date.after
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.beOfType
import io.mockk.coVerify
import io.mockk.unmockkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class ApplicationTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
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
                app.signalMessageReceiver
                app.signalMessageSender
                app.socketMessageReceiver
                app.socketMessageSender
            }

            "initializes and runs all 'hot' application components" {
                app.socketServer.listenJob.isActive shouldBe true
                app.socketServer.socket.isClosed shouldBe false
            }
        }

        "#stop" - {
            val res = app.stop()

            "closes down all 'hot' app components" {
                app.socketServer.listenJob.isActive shouldBe false
                app.socketServer.socket.isClosed shouldBe true
            }

            "returns a reference to the application for restarting" {
                res should beOfType<Application>()
            }
        }
    }
})
