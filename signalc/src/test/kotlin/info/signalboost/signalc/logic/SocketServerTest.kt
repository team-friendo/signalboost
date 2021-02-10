package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.util.UnixServerSocket
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.unmockkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServerTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketServer::class, UnixServerSocket::class)
        val app = Application(config).run(testScope)
        val socketServer = app.socketServer

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            unmockkAll()
            testScope.teardown()
        }

        "#run" - {
            "accepts a socket connection" {}
            "remembers the socket connection" {}
            "attaches a message receiver to the connection" {}
            "attaches a message sender to the connection" {}
        }

        "#disconnect" - {
            "disconnects a socket connection's message receiver" {}
            "disconnects a socket connection's message sender" {}
            "closes the socket connection" {}
            "forgets about the socket connection" {}
        }

        "#stop" - {
            "disconnects receivers from all socket connections" {}
            "disconnects senders from all socket connections" {}
            "closes all socket connections" {}
            "forgets about all socket connections" {}
        }
    }
})
