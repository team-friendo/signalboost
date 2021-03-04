package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genAbortWarning
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genCleartext
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genDecryptionError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genRequestHandlingError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genDropped
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genRegistrationSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genRequestInvalidError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSendResults
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSubscriptionDisrupted
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSubscriptionFailed
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genSubscriptionSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genTrustSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVerificationError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVerificationSuccess
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVersionResponse
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import java.io.PrintWriter
import java.net.Socket
import java.util.concurrent.atomic.AtomicInteger
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageSenderTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(SocketMessageSender::class)
        val app = Application(config).run(testScope)

        val mockSockets = List(2) { mockk<Socket>() }
        val mockSocket = mockSockets[0]

        val writes = AtomicInteger(0)
        val mockWriters = List(2) {
            mockk<PrintWriter>() {
                every { println(any<String>()) } answers { writes.getAndIncrement() }
                every { close() } returns Unit
            }
        }
        val mockWriter = mockWriters[0]
        val sendDelay = 2.milliseconds

        beforeSpec {
            mockkObject(SocketMessageSender.Writer)
            coEvery { SocketMessageSender.Writer.to(any(), any()) } coAnswers {
                mockWriters[mockSockets.indexOf(firstArg())]
            }
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            unmockkAll()
            testScope.teardown()
        }

        "#connect" - {
            "when called with a socket not yet in the pool" - {
                "adds a writer on that socket to the to the writer pool" {
                    app.socketMessageSender.connect(mockSocket) shouldBe true
                    app.socketMessageSender.writerPool.writers[mockSocket.hashCode()]
                        ?.writer shouldBe mockWriter
                }
            }

            "when called with a socket already in the pool" - {
                "does not add a writer to the pool" {
                    app.socketMessageSender.connect(mockSocket)
                    val poolSize = app.socketMessageSender.writerPool.writers.size

                    app.socketMessageSender.connect(mockSocket) shouldBe false
                    app.socketMessageSender.writerPool.writers.size shouldBe poolSize
                }
            }

        }

        "#disconnect" - {
            "when called with the hash of a socket with a writer in the pool" - {
                app.socketMessageSender.connect(mockSocket)
                app.socketMessageSender.close(mockSocket.hashCode())

                "closes the socket writer" {
                    verify {
                        mockWriter.close()
                    }
                }

                "removes the writer from the pool" {
                    app.socketMessageSender.writerPool.writers[mockSocket.hashCode()] shouldBe null
                }
            }

        }

        "#stop" - {
            "when there are 2 writers in pool" - {
                mockSockets.forEach {
                    app.socketMessageSender.connect(it)
                }

                "closes all both writers and removes them from pool" {
                    app.socketMessageSender.stop() shouldBe 2
                    app.socketMessageSender.writerPool.writers.size shouldBe 0
                    mockWriters.forEach {
                        verify { it.close() }
                    }
                }
            }
        }

        "#send" - {
            "when called once" - {
                app.socketMessageSender.connect(mockSocket)

                "with a handled message" - {
                    val responses = listOf(
                        genAbortWarning(),
                        genCleartext(),
                        genDecryptionError(),
                        genRegistrationSuccess(),
                        genRequestHandlingError(),
                        genRequestInvalidError(),
                        genSendResults(),
                        genSubscriptionSuccess(),
                        genSubscriptionFailed(),
                        genSubscriptionDisrupted(),
                        genTrustSuccess(),
                        genVerificationSuccess(),
                        genVerificationError(),
                        genVersionResponse(),
                    )

                    "writes serialized response to socket" {
                        responses.forEach {
                            app.socketMessageSender.send(it)
                            delay(sendDelay)
                            verify {
                                mockWriter.println(it.toJson())
                            }
                        }
                    }
                }

                "with an unhandled message" - {
                    val responses = listOf(
                        genDropped(1),
                        SocketResponse.Empty,
                    )

                    "does not write to socket" {
                        responses.forEach {
                            app.socketMessageSender.send(it)
                            delay(sendDelay)
                            verify(exactly = 0) {
                                mockWriter.println(any<String>())
                            }
                        }
                    }
                }

            }

            "when called many times concurrently" - {
                mockSockets.forEach {
                    app.socketMessageSender.connect(it)
                }

                "distributes messages across socket writers" {
                    val response = genVerificationSuccess()
                    val numMessages = 100

                    repeat(numMessages) {
                        launch {
                            app.socketMessageSender.send(response)
                        }
                    }

                    delay(sendDelay * numMessages)

                    verify(atLeast = numMessages / 4) {
                        mockWriters[0].println(any<String>())
                    }
                    verify(atLeast = numMessages / 4) {
                        mockWriters[1].println(any<String>())
                    }
                }
            }
        }
    }
})
