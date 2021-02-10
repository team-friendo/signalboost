package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.SocketOutMessage.genCleartext
import info.signalboost.signalc.testSupport.fixtures.SocketOutMessage.genCommandExecutionError
import info.signalboost.signalc.testSupport.fixtures.SocketOutMessage.genDropped
import info.signalboost.signalc.testSupport.fixtures.SocketOutMessage.genShutdown
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.longs.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import java.io.PrintWriter
import java.net.Socket
import java.util.concurrent.atomic.AtomicInteger
import kotlin.system.measureTimeMillis
import kotlin.time.ExperimentalTime
import kotlin.time.measureTime
import kotlin.time.milliseconds
import kotlin.time.nanoseconds

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageSenderTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
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
            // app.socketMessageSender.writerPool.clear()
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            // app.stop()
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
                app.socketMessageSender.disconnect(mockSocket.hashCode())

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

                "with a cleartext message" - {
                    val msg = genCleartext()

                    "writes serialized message to socket" {
                        app.socketMessageSender.send(msg)
                        verify {
                            mockWriter.println("\nMessage from [${msg.sender.number.get()}]:\n${msg.body}\n")
                        }
                    }
                }

                "with a dropped message" - {
                    val msg = genDropped(1)
                    val envType =  EnvelopeType.fromInt(1)

                    "writes serialized message to socket" {
                        app.socketMessageSender.send(msg)
                        delay(sendDelay)
                        verify {
                            mockWriter.println("Dropped: $envType")
                        }
                    }
                }

                "with an empty message" - {
                    "writes serialized message to socket" {
                        app.socketMessageSender.send(Empty)
                        delay(sendDelay)
                        verify {
                            mockWriter.println("Dropped: EMPTY")
                        }
                    }
                }

                "with a shutdown message" - {
                    val msg = genShutdown()

                    "writes serialized message to socket" {
                        app.socketMessageSender.send(msg)
                        delay(sendDelay)
                        verify {
                            mockWriter.println("Shutting down. Bye!")
                        }
                    }
                }

                "with a command execution error" - {
                    val msg = genCommandExecutionError()

                    "writes serialized message to socket" {
                        app.socketMessageSender.send(msg)
                        delay(sendDelay)
                        verify {
                            mockWriter.println("Error dispatching command: ${msg.error}")
                        }
                    }
                }

                "with a miscelaneous message" - {

                    "writes it to socket" {
                        app.socketMessageSender.send(SendSuccess)
                        delay(sendDelay)
                        verify {
                            mockWriter.println(SendSuccess.toString())
                        }
                    }
                }
            }

            "when called many times concurrently" - {
                mockSockets.forEach {
                    app.socketMessageSender.connect(it)
                }

                "distributes messages across socket writers" {
                    repeat(100) {
                        testScope.launch {
                            app.socketMessageSender.send(Empty)
                        }
                    }
                    verify(atLeast = 20) {
                        mockWriters[0].println(any<String>())
                    }
                    verify(atLeast = 20) {
                        mockWriters[1].println(any<String>())
                    }
                }

                "sends messages in parallel" {
                    fun observeNWrites(n: Int) = async {
                        writes.set(0)
                        repeat(n) {
                            app.socketMessageSender.send(Empty)
                        }
                        while(writes.get() < n) {
                            yield()
                        }
                        return@async
                    }

                    val single = measureTime {
                        observeNWrites(1).await()
                    }

                    val many = measureTime {
                        observeNWrites(100).await()
                    }

                    many / single shouldBeLessThan 100.0
                }
            }
        }
    }
})
