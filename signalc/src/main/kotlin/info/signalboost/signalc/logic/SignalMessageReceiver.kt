package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.VerifiedAccount
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import java.util.concurrent.TimeUnit


@ExperimentalCoroutinesApi
class SignalMessageReceiver(app: Application) {
    companion object {
        private const val TIMEOUT = 1000L * 60 * 60 // 1 hr (copied from signald)
    }

    private val signal = app.signal
    private val coroutineScope = app.coroutineScope

    private fun messagePipeOf(account: VerifiedAccount) = SignalServiceMessageReceiver(
        signal.configs,
        account.credentialsProvider,
        signal.agent,
        null, // TODO: see [1] below
        UptimeSleepTimer(),
        signal.clientZkOperations?.profileOperations,
    ).createMessagePipe()

    suspend fun receiveMessages(account: VerifiedAccount): ReceiveChannel<SignalServiceEnvelope> {
        // TODO(aguestuser|2021-01-21):
        //  make this resilient to duplicate subscriptions by:
        //  - keeping hashmap of messagePipes
        //  - if caller tries to create a message pipe for an account that already has one, return null
        //  -> caller only gets a receive channel if one doesn't already exist somewhere else
        //  -> we can leverage the hashmap for unsubscribing
        //  handle:
        //  - timeout
        //  - closed connection (understand `readyOrEmtpy()`?)
        //  - closed channel
        //  - random runtime error
        //  - cleanup message pipe on unsubscribe (by calling messagePipe.shutdown())
        val messagePipe = messagePipeOf(account)
        val channel = Channel<SignalServiceEnvelope>()
        coroutineScope.launch {
            withContext(Dispatchers.IO) {
                while(!channel.isClosedForSend){
                    channel.send(
                        messagePipe.read(TIMEOUT, TimeUnit.MILLISECONDS)
                    )
                }
            }
        }
        return channel
    }
}

/*[1]**********
 * TODO: signald (and thus we) leave ConnectivityListener unimplemented.
 *  We likely should not follow suit. Here is what a ConnectivityListener does:
 *
 *  public interface ConnectivityListener {
 *    void onConnected();
 *    void onConnecting();
 *    void onDisconnected();
 *    void onAuthenticationFailure();
 * }
 *
 **/
