package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.unmockkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest

@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageSenderTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketMessageSender::class)
        val app = Application(config).run(testScope)
        val messageReceiver = app.signalMessageReceiver

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
            testScope.teardown()
        }

        "#connect" - {
            "stores a record of the socket connection" {}
            "adds a socket writer to the writer pool" {}
        }

        "#disconnect" - {
            "closes the socket writer" {}
            "deletes the record of the socket connection" {}
        }

        "#stop" - {
            "closes all socket writers and forgets their socket connections" {}
        }

        "#send" - {
            "acquires a writer from the pool" {}
            "uses the writer to emits a message to the socket" {}
            "releases the writer back to the pool after sending message" {}
            "handles different message types correctly" {
                // since the logic is uninteresting (and will be replaced by
                // hypertrivial JSON serialization), just do one test for:
                // Cleartext, Dropped, Empty, Shutdown, CommandExecutionError, unknown
            }
        }

        "WriterPool" - {
            "#add" - {
                "adds a writer resource to the pool" {}
            }

            "#acquire" - {
                "when an unlocked writer is available" - {
                    "acquires the lock on the writer and returns it" {}
                }
                "when no unlocked writers are available" - {
                    "retries until an unlocked writer is available" {}
                }
            }

            "#release" - {
                "releases the lock on a writer back to the pool" {}
            }
            "#remove" - {
                "when writer is in pool and unlocked" - {
                    "removes it from the pool" {}
                }
                "when writer is in pool but locked" - {
                    "retries (after yielding)" {}
                }
                "when writer is not in pool" - {
                    "performs NOOP" {}
                }

            }
        }
    }
})
