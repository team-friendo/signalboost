package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.error.SignalcError
import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.channels.actor
import mu.KLogging
import java.io.PrintWriter
import java.net.Socket
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
//@InternalCoroutinesApi
class SocketSender(private val app: Application) {
    companion object: KLogging()

    // this is mostly here as a testing seam
    internal object Writer {
        suspend fun to(socket: Socket, coroutineScope: CoroutineScope): PrintWriter = coroutineScope.async(IO) {
            PrintWriter(socket.getOutputStream(), true)
        }.await()
    }

    internal val writerPool = WriterPool(app)

    /*************
     * INTERFACE
     *************/

    suspend fun connect(socket: Socket): Boolean = writerPool.add(socket)
    suspend fun close(socketHash: SocketHashCode): Boolean = writerPool.remove(socketHash)
    suspend fun send(socketMsg: SocketResponse): Unit = writerPool.send(socketMsg)
    suspend fun stop(): Int = writerPool.clear()

    /***************
     * WRITER POOL
     ***************/

    class WriterPool(app: Application) {
        companion object: KLogging()

        internal val writers: MutableMap<SocketHashCode,WriterResource> = mutableMapOf()

        sealed class Message {
            data class Add(val socket: Socket, val result: CompletableDeferred<Boolean>): Message()
            data class Remove(val socketHash: SocketHashCode, val result: CompletableDeferred<Boolean>): Message()
            data class Send(val socketMsg: SocketResponse, val result: CompletableDeferred<Unit>): Message()
            data class Clear(val result: CompletableDeferred<Int>): Message()
        }

        suspend fun add(socket: Socket): Boolean = CompletableDeferred<Boolean>().let {
            input.send(Message.Add(socket, it))
            it.await()
        }

        suspend fun clear(): Int = CompletableDeferred<Int>().let {
            input.send(Message.Clear(it))
            it.await()
        }

        suspend fun remove(socketHash: SocketHashCode): Boolean = CompletableDeferred<Boolean>().let {
            input.send(Message.Remove(socketHash, it))
            it.await()
        }

        suspend fun send(socketMsg: SocketResponse): Unit = CompletableDeferred<Unit>().let {
            input.send(Message.Send(socketMsg, it))
            it.await()
        }

        // Here we use an actor to enforce threadsafe mutation of our pool of writers.
        private val input = app.coroutineScope.actor<Message>(IO) {
            for(msg in channel) {
                when (msg) {
                    is Message.Add -> {
                        val socketHash = msg.socket.hashCode()
                        writers[socketHash]?.let {
                            logger.error("Failed to add writer for socket $socketHash")
                            msg.result.complete(false)
                        } ?: run {
                            writers[socketHash] = WriterResource(
                                app.coroutineScope,
                                Writer.to(msg.socket, app.coroutineScope),
                            )
                            msg.result.complete(true)
                        }
                    }
                    is Message.Clear -> {
                        writers.values.map {
                            async { it.close() }
                        }.awaitAll().let {
                            writers.clear()
                            msg.result.complete(it.size)
                        }
                    }
                    is Message.Remove -> {
                        writers[msg.socketHash]?.let {
                            it.close()
                            writers.remove(msg.socketHash)
                            msg.result.complete(true)
                        } ?: run {
                            msg.result.complete(false)
                        }
                    }
                    is Message.Send -> {
                        val socketHash = writers.keys.random()
                        writers[socketHash]?.let {
                            // Since actors process one message at a time, we launch a new coroutine, inside
                            // of which to write to the socket. This increases throughput by allowing the actor
                            // to process the next `Send` message without waiting for the write to complete.
                            // (Queueing on the socket writer is handled by the Writer's internal socket below.)
                            app.coroutineScope.launch(IO) {
                                it.send(msg.socketMsg)
                            }
                            msg.result.complete(Unit)
                        } ?: run {
                            val errorMsg = "Failed to acquire writer for socket $socketHash"
                            logger.error(errorMsg)
                            msg.result.completeExceptionally(SignalcError.WriterMissing(errorMsg))
                        }
                    }
                }
            }
        }
    }

    /*******************
     * WRITER RESOURCE
     *******************/

    class WriterResource(coroutineScope: CoroutineScope, internal val writer: PrintWriter) {
        sealed class Message {
            data class Send(val socketMsg: SocketResponse, val result: CompletableDeferred<Unit>) : Message()
            data class Close(val result: CompletableDeferred<Unit>) : Message()
        }

        suspend fun send(socketMsg: SocketResponse): Unit = CompletableDeferred<Unit>().let {
            input.send(Message.Send(socketMsg, it))
            it.await()
        }

        suspend fun close(): Unit = CompletableDeferred<Unit>().let {
            input.send(Message.Close(it))
            it.await()
        }

        // Here we use an actor to enforce threadsafe usage of our PrintWriter resource
        // and to get "for-free" FIFO queueing of messages to be written by it.
        private val input: SendChannel<Message> = coroutineScope.actor(IO) {
            for (msg in channel) {
                when (msg) {
                    is Message.Send -> {
                        when (msg.socketMsg) {
                            is SocketResponse.Dropped, SocketResponse.Empty -> {}
                            else -> writer.println(msg.socketMsg.toJson())
                        }
                        msg.result.complete(Unit)
                    }
                    is Message.Close -> {
                        writer.close()
                        msg.result.complete(Unit)
                    }
                }
            }
        }
    }
}