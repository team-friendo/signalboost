package info.signalboost.signalc.logic


import info.signalboost.signalc.Config.SIGNAL_AGENT
import info.signalboost.signalc.Config.signalServiceConfig
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.store.AccountStore
import org.whispersystems.libsignal.state.SignalProtocolStore
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccess
import org.whispersystems.signalservice.api.profiles.SignalServiceProfile
import org.whispersystems.signalservice.api.push.exceptions.AuthorizationFailedException
import org.whispersystems.signalservice.internal.push.VerifyAccountResponse
import java.util.*

import kotlin.random.Random

class AccountManager(private val protocolStore: SignalProtocolStore, private val accountStore: AccountStore) {

    fun findOrCreate(username: String): Account = accountStore.findOrCreate(username)

    // register an account with signal server and request an sms token to use to verify it (storing account in db)
    fun register(account: NewAccount): RegisteredAccount {
        account.manager.requestSmsVerificationCode(false, absent(), absent())
        return accountStore.save(RegisteredAccount.fromNew(account))
    }

    // provide a verification code, retrieve and store a UUID (storing account in db when done)
    fun verify(account: RegisteredAccount, code: String): VerifiedAccount? {
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
        // TODO(aguestuser|2020-12-23):
        //  - as a privacy matter, we might eventually want to throw away phone numbers once we have a UUID
        //  - if so, consider udpating `accountId` in protocol store to this uuid at this point?
        return accountStore.save(VerifiedAccount.fromRegistered(account, uuid))
    }

    // generate prekeys, store them locally and publish them to signal
    fun publishFirstPrekeys(account: VerifiedAccount): VerifiedAccount {
        // TODO: should we generate a sequential set of ids from postgres instead of random ints?
        // generate prekeys and store them locally
        val signedPrekeyId = Random.nextInt(0, Integer.MAX_VALUE)
        val signedPreKey = KeyUtil.genSignedPreKey(
            protocolStore.identityKeyPair,
            signedPrekeyId
        ).also {
            protocolStore.storeSignedPreKey(it.id, it)
        }
        val oneTimePreKeys = KeyUtil.genPreKeys(0, 100).onEach {
            protocolStore.storePreKey(it.id, it)
        }
        // publish prekeys to signal server
        account.manager.setPreKeys(
            protocolStore.identityKeyPair.publicKey,
            signedPreKey,
            oneTimePreKeys
        )
        return account
    }

    // construct a signal service message sender from a verified account
    fun messageSenderOf(account: VerifiedAccount): SignalServiceMessageSender =
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

