package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.CacheUtil.getMemoized
import info.signalboost.signalc.util.TimeUtil
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.SendChannel
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
//@InternalCoroutinesApi
class SignalSender(private val app: Application) {
    companion object {
        const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day
        val MESSAGE_QUEUE_SIZE = Application.availableProcessors
        fun String.asAddress() = SignalServiceAddress(null, this)
        fun UUID.asAddress() = SignalServiceAddress(this, null)
    }


    private val messageSenders = ConcurrentHashMap<String,SignalServiceMessageSender>()

    private fun messageSenderOf(account: VerifiedAccount): SignalServiceMessageSender =
        getMemoized(messageSenders, account.username) {
            SignalServiceMessageSender(
                app.signal.configs,
                account.credentialsProvider,
                app.protocolStore.of(account),
                app.signal.agent,
                true,
                Optional.of(app.signalReceiver.messagePipeOf(account)), // pipe
                Optional.absent(), // unidentifiedPipe
                Optional.absent(), // eventListener
                null,
                IO.asExecutor() as? ExecutorService,
                -1L,
                true,
            )
        }

    data class QueuedMessage(
        val sender: VerifiedAccount,
        val recipient: SignalServiceAddress,
        val dataMessage: SignalServiceDataMessage,
        val result: CompletableDeferred<SendMessageResult>,
    )

    private val messageQueues = ConcurrentHashMap<String,SendChannel<QueuedMessage>>()
    private suspend fun messageQueueOf(account: VerifiedAccount): SendChannel<QueuedMessage> =
        getMemoized(messageQueues, account.username) {
//            **** Actor way *******
//            app.coroutineScope.actor(IO, MESSAGE_QUEUE_SIZE) {
//                for (qm in channel) {
//                    qm.result.complete(
//                        messageSenderOf(qm.sender).sendMessage(
//                            qm.recipient,
//                            Optional.absent(),
//                            qm.dataMessage
//                        )
//                    )
//                }
//            }
//          **** Channel way *****
            Channel<QueuedMessage>(MESSAGE_QUEUE_SIZE).also {
                app.coroutineScope.launch(IO) {
                    while(!it.isClosedForReceive) {
                        val qm = it.receive()
                        qm.result.complete(
                            messageSenderOf(qm.sender).sendMessage(
                                qm.recipient,
                                Optional.absent(),
                                qm.dataMessage
                            )
                        )
                    }
                }
            }
        }



// FAILED BATCHING ATTEMPTS (both not faster and get stuck when mesages are not increments of QUEUE_SIZE)
//    private suspend fun messageQueueOf(account: VerifiedAccount): Channel<QueuedMessage> =
//        getMemoized(messageQueues, account.username) {
//            Channel<QueuedMessage>(MESSAGE_QUEUE_SIZE).also { chan ->
//                app.coroutineScope.launch(IO) {
//                    while(!chan.isClosedForReceive) {
//                        **** with a list ****
//                        List(MESSAGE_QUEUE_SIZE) { chan.receive() }
//                        .forEach { (sender, recipient, dataMessage, result) ->
//                            result.complete(
//                                messageSenderOf(sender).sendMessage(
//                                    recipient,
//                                    Optional.absent(),
//                                    dataMessage
//                                )
//                            )
//                        }
//                        **** with a Flow *****
//                        List(MESSAGE_QUEUE_SIZE) { chan.receive() }
//                            .asFlow()
//                            .map {
//                                Pair(
//                                    it.result,
//                                    messageSenderOf(it.sender).sendMessage(
//                                        it.recipient,
//                                        Optional.absent(),
//                                        it.dataMessage
//                                    )
//                                )
//                            }
//                            .toList()
//                            .forEach { it.first.complete(it.second) }
//
//                    }
//                }
//            }
//        }

    suspend fun send(
        sender: VerifiedAccount,
        recipient: SignalServiceAddress,
        body: String,
        timestamp: Long = TimeUtil.nowInMillis(),
        expiration: Int = DEFAULT_EXPIRY_TIME,
    ): SendMessageResult {
        val dataMessage =  SignalServiceDataMessage
            .newBuilder()
            .withBody(body)
            .withTimestamp(timestamp)
            .withExpiration(expiration)
            .build()
        // TODO: handle `signalservice.api.push.exceptions.NotFoundException` here
        val result = CompletableDeferred<SendMessageResult>()
        messageQueueOf(sender).send(QueuedMessage(sender, recipient, dataMessage, result))
        return result.await()
    }
}