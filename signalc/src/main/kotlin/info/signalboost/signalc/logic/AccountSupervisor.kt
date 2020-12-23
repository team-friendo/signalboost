package info.signalboost.signalc.logic


import info.signalboost.signalc.Config.SIGNAL_AGENT
import info.signalboost.signalc.Config.signalServiceConfig
import info.signalboost.signalc.store.HashMapProtocolStore
import info.signalboost.signalc.logic.UnregisteredAccount
import info.signalboost.signalc.logic.RegisteredAccount
import org.whispersystems.libsignal.state.SignalProtocolStore
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccess
import org.whispersystems.signalservice.api.profiles.SignalServiceProfile
import org.whispersystems.signalservice.api.push.exceptions.AuthorizationFailedException
import org.whispersystems.signalservice.internal.push.VerifyAccountResponse
import java.util.*

import kotlin.random.Random

class AccountSupervisor(private val protocolStore: SignalProtocolStore) {

    /** UNREGISTERED ACCOUNT OPERATIONS **/

    // register an account with signal server and reqeust an sms token to use to verify it
    fun register(account: UnregisteredAccount): Unit =
        account.manager.requestSmsVerificationCode(false, absent(), absent())

    // provide a verification code, retrieve and store a UUID
    fun verify(account: UnregisteredAccount, code: String): RegisteredAccount? {
        val verifyResponse: VerifyAccountResponse = try {
            account.manager.verifyAccountWithCode(
                code,
                null,
                protocolStore.localRegistrationId,
                true,
                null,
                null,
                UnidentifiedAccess.deriveAccessKeyFrom(account.profileKey),
                false,
                SignalServiceProfile.Capabilities(true, false, false),
                true
            )
        } catch(e: AuthorizationFailedException) {
            return null
        }
        val uuid = UUID.fromString(verifyResponse.uuid)
        return RegisteredAccount.fromUnregisteredAccount(account, uuid)
    }

    /** REGISTERED ACCOUNT OPERATIONS **/

    fun publishFirstPrekeys(account: RegisteredAccount) {
        // generate prekeys and store them locally
        val signedPrekeyId = Random.nextInt(0, Integer.MAX_VALUE)
        val signedPreKey = KeyUtil.genSignedPreKey(HashMapProtocolStore.ownIdentityKeypair, signedPrekeyId).also {
            account.protocolStore.storeSignedPreKey(it.id, it)
        }
        val oneTimePreKeys = KeyUtil.genPreKeys(0, 100).onEach {
            account.protocolStore.storePreKey(it.id, it)
        }
        // publish prekeys to signal server
        account.manager.setPreKeys(
            account.protocolStore.identityKeyPair.publicKey,
            signedPreKey,
            oneTimePreKeys
        )
    }

    fun messageSenderOf(account: RegisteredAccount): SignalServiceMessageSender =
        SignalServiceMessageSender(
            signalServiceConfig,
            account.credentialsProvider,
            protocolStore,
            SIGNAL_AGENT,
            true,
            false,
            absent(),
            absent(),
            absent(),
            null,
            null,
        )
}

