package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.actor
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.PrintWriter
import java.net.Socket
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class LegacySocketMessageSender(private val app: Application) {

    data class WriterResource(
        val socketHash: SocketHashCode,
        val writer: PrintWriter,
        var isAvailable: Boolean,
    )

    private val writerPool = WriterPool(app)
    private val socketHashesLock = Mutex()
    private val socketHashes = mutableSetOf<SocketHashCode>()

    /*************
     * LIFECYCLE
     *************/

    suspend fun connect(socket: Socket): SocketHashCode? = socketHashesLock.withLock {
        socket.hashCode().let {
            if (socketHashes.contains(it)) null
            else withContext(Dispatchers.IO) {
                writerPool.add(
                    WriterResource(
                        socketHash = it,
                        writer = PrintWriter(socket.getOutputStream(), true),
                        isAvailable = true
                    )
                )
            }
        }
    }

    suspend fun disconnect(socketHash: SocketHashCode): Boolean = withContext(Dispatchers.IO) {
        socketHashesLock.withLock { socketHashes.remove(socketHash) }
        writerPool.remove(socketHash).also {
            println("Closed writer to socket $socketHash.")
        }
    }

    suspend fun stop(): Boolean = socketHashesLock.withLock {
        socketHashes.fold(true){ acc, hash -> acc && disconnect(hash) }
    }

    /********************
     * MESSAGE HANDLING
     ********************/

    suspend fun send(msg: SocketOutMessage): Job =
        // we launch a coroutine to accomodate the fact that acquire recurs in an (otherwise infinite) loop
        app.coroutineScope.launch {
            withContext(Dispatchers.IO) {
                // TODO: encapsulate (JSON) serialization logic in SignalMessage
                val (socketHash, writer) = writerPool.acquire()

                // TODO: encapsulate (JSON) serialization logic in SignalMessage
                when (msg) {
                    is Cleartext ->
                        writer.println("\nMessage from [${msg.sender.number.orNull()}]:\n${msg.body}\n")
                    is Dropped ->
                        writer.println("Dropped: ${EnvelopeType.fromInt(msg.envelope.type)}")
                    is Empty ->
                        writer.println("Dropped: EMPTY")
                    is Shutdown ->
                        writer.println("Shuting down. Bye!")
                    is CommandExecutionError ->
                        writer.println("Error dispatching command: ${msg.error}")
                    else -> writer.println(msg)
                }

                writerPool.release(socketHash)
            }
        }


    /********************
     * POOL MANAGEMENT
     *******************/

    class WriterPool(app: Application) {
        /*** SCHEMA ****
         * Some custom data classes for our pool!
         * ***/

        sealed class PoolMessage {
            data class Acquire(val result: CompletableDeferred<WriterResource>) : PoolMessage()
            data class Add(val writerResource: WriterResource, val result: CompletableDeferred<SocketHashCode>) : PoolMessage()
            data class Release(val socketHash: SocketHashCode, val result: CompletableDeferred<Boolean>) : PoolMessage()
            data class Remove(val socketHash: SocketHashCode, val result: CompletableDeferred<RemovalResult>) : PoolMessage()
        }

        enum class RemovalResult {
            SUCCESS,
            NOT_PRESENT,
            LOCKED,
        }

        /*** HELPERS (internal interface) ****
         * These all send messages to our writer pool actor, wait for the actor to complete
         * a Deferred passed to it, and wrap the result in a suspend fuction. (So callers don't
         * have to reason about `CompleteableDeferred`s -- let's be honest: nobody wants to do that.)
         **************************************/

        suspend fun add(writerResource: WriterResource): SocketHashCode = CompletableDeferred<SocketHashCode>().let {
            // Adds a writer resource to the socket pool, returns its hash code.
            // We are protected from
            pool.send(PoolMessage.Add(writerResource, it))
            it.await()
        }

        suspend fun acquire(): WriterResource = CompletableDeferred<WriterResource>().let {
            // return a WriterResource from the pool (and mark it as unavailable until released)
            pool.send(PoolMessage.Acquire(it))
            val resource = it.await()
            if(resource.isAvailable) resource else acquire()
        }

        suspend fun release(socketHash: SocketHashCode): Unit = CompletableDeferred<Boolean>().let {
            // Attempt to release the WriterResource corresponding to this socket.
            // Return true if it was released, false if it was eitehr not in the pool or already available
            pool.send(PoolMessage.Release(socketHash, it))
            it.await()
        }

        suspend fun remove(writerHashCode: Int): Boolean = CompletableDeferred<RemovalResult>().let {
            pool.send(PoolMessage.Remove(writerHashCode, it))
            when(it.await()) {
                RemovalResult.SUCCESS -> true
                RemovalResult.NOT_PRESENT -> false
                RemovalResult.LOCKED -> {
                    yield() // Avoid blocking execution of coroutines calling `acquire` if we loop here.
                    remove(writerHashCode)
                }
            }
        }

        /*** ACTOR ****
         * Here, we rely on this actor's single-threaded dispatcher to enforce atomic mutations
         * of our writers hashmap, and prevent concurrent modification errors. (Ie: it acts like
         * a suspending mutex without having to reason about a lock.)
         **************/
        private val actorContext = newSingleThreadContext("writerPool")
        private val pool = app.coroutineScope.actor<PoolMessage>(actorContext) {
            val writers = mutableMapOf<SocketHashCode, WriterResource>()

            // Loop for reading messages to the actor.
            for (msg in channel) {
                when (msg) {
                    is PoolMessage.Add -> {
                        msg.writerResource.socketHash.let {
                            writers[it] = msg.writerResource
                            msg.result.complete(it)
                        }
                    }
                    is PoolMessage.Acquire -> {
                        val key = writers.keys.random()
                        val resource = writers[key]!!
                        writers[key] = resource.copy(isAvailable = false)
                        msg.result.complete(resource)
                    }
                    is PoolMessage.Release -> {
                        writers[msg.socketHash]?.let {
                            if (it.isAvailable) msg.result.complete(false)
                            else {
                                writers[msg.socketHash] = it.copy(isAvailable = true)
                                msg.result.complete(true)
                            }
                        } ?: msg.result.complete(false)
                    }
                    is PoolMessage.Remove -> {
                        writers[msg.socketHash]?.let {
                            if(!it.isAvailable)
                                msg.result.complete(RemovalResult.LOCKED)
                            else {
                                writers.remove(msg.socketHash)
                                msg.result.complete(RemovalResult.SUCCESS)
                            }
                        } ?: msg.result.complete(RemovalResult.NOT_PRESENT)
                    }
                }
            }
        }
    }
}