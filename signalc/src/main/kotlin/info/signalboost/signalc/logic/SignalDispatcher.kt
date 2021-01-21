package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.internal.push.SignalServiceProtos
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.CIPHERTEXT_VALUE
import java.net.ProtocolException

@ExperimentalCoroutinesApi
class SignalDispatcher(
    private val app: Application,
    private val messageReceiver: MessageReceiver = MessageReceiver(app)
) {

    private val protocolStore = app.store.signalProtocol
    private val coroutineScope = app.coroutineScope
    private val signal = app.signal

    // TODO: memoize this?
    private fun cypherOf(account: VerifiedAccount) = SignalServiceCipher(
        account.address,
        protocolStore.of(account),
        signal.certificateValidator
    )

    suspend fun subscribe(account: VerifiedAccount): ReceiveChannel<Message> {
        // TODO: what if someone subscribes the same account twice?
        val inChannel = messageReceiver.receiveMessages(account)
        val outChannel = Channel<Message>()

        coroutineScope.launch {
            withContext(Dispatchers.IO) {
                while (!inChannel.isClosedForReceive && !outChannel.isClosedForSend) {
                    val envelope = inChannel.receive()
                    dispatch(envelope, account, outChannel)
                }
            }
        }

        return outChannel
    }

    private suspend fun dispatch(
        envelope: SignalServiceEnvelope,
        account: VerifiedAccount,
        outChannel: Channel<Message>
    ) {
        when(envelope.type) {
            CIPHERTEXT_VALUE -> handleCyphertext(envelope, account, outChannel)
            // TODO: handle other message types:
            //  - UNKNOWN, KEY_EXCHANGE, PREKEY_BUNDLE, UNIDENTIFIED_SENDER, RECEIPT
            else -> drop(envelope, account, outChannel)
        }
    }

    private suspend fun handleCyphertext(
        envelope: SignalServiceEnvelope,
        account: VerifiedAccount,
        outChannel: Channel<Message>
    ){
        // Decrypt cyphertext on the CPU-optimized threadpool and put the cleartext on the out channel
        val (sender, recipient) = (envelope.asSender() to account.asRecipient())
        withContext(Dispatchers.Default) {
            try {
                val cleartext = cypherOf(account).decrypt(envelope).dataMessage.orNull()?.body?.orNull()
                cleartext
                    ?.let { outChannel.send(Cleartext(sender, recipient, it)) }
                    ?: outChannel.send(EmptyMessage(sender, recipient))
            } catch(e: Exception) {
                outChannel.send(DecryptionError(sender, recipient, e))
            }
        }
    }

    private suspend fun drop(
        envelope: SignalServiceEnvelope,
        account: VerifiedAccount,
        outChannel: Channel<Message>
    ) {
        outChannel.send(DroppedMessage(envelope.asSender(), account.asRecipient(), envelope))
    }

    private fun SignalServiceEnvelope.asSender(): SignalServiceAddress = sourceAddress
    private fun VerifiedAccount.asRecipient(): SignalServiceAddress = address
}