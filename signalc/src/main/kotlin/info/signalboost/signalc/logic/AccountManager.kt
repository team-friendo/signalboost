package info.signalboost.signalc.logic


import info.signalboost.signalc.Application
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.metrics.Metrics
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.KeyUtil
import kotlinx.coroutines.*
import mu.KLoggable
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.account.AccountAttributes
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccess
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccessPair
import org.whispersystems.signalservice.api.push.exceptions.AuthorizationFailedException
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import org.whispersystems.signalservice.internal.push.VerifyAccountResponse
import java.io.IOException
import java.util.UUID
import kotlin.io.path.ExperimentalPathApi
import kotlin.jvm.Throws
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ExperimentalPathApi
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class AccountManager(private val app: Application) {

    companion object: Any(), KLoggable {
        override val logger = logger()
        const val PREKEY_MAX_ID: Int = 0xFFFFF
        const val PREKEY_MIN_RESERVE = 10
        const val PREKEY_BATCH_SIZE = 100
    }

    private val accountStore = app.accountStore
    private val protocolStore = app.protocolStore
    private val signal = app.signal

    // NOTE(aguestuser|2020-05-23):
    // We used to memoize account managers, but suspect it created some odd state w/ refreshing PreKeys.
    // Since there is (1) little benefit from caching objects that we so rarely use, (2) little cost to creating them
    // every time we need them, and (3) some potential cost to keeping unused objects cached, we will henceforth simply
    // construct account managers on demand, and leave this note in case we ever want to reconsider the trade-offs!
    private fun accountManagerOf(account: Account): SignalServiceAccountManager =
        SignalServiceAccountManager(
            signal.configs,
            account.credentialsProvider,
            signal.agent,
            signal.groupsV2Operations,
            true, // automaticNetworkRetry
            UptimeSleepTimer()
        )

    private suspend fun accountManagerOf(accountId: String): SignalServiceAccountManager =
        accountManagerOf(load(accountId))

    suspend fun load(accountId: String): Account = accountStore.findOrCreate(accountId)

    suspend fun loadVerified (accountId: String): VerifiedAccount? =
        when(val acc = accountStore.findOrCreate(accountId)) {
            is VerifiedAccount -> acc
            else -> null
        }


    // register an account with signal server and request an sms token to use to verify it (storing account in db)
    suspend fun register(account: NewAccount, captcha: String? = null): RegisteredAccount {
        app.coroutineScope.async(Concurrency.Dispatcher) {
            accountManagerOf(account).requestSmsVerificationCode(
                false,
                captcha?.let { Optional.of(it) } ?: Optional.absent(),
                Optional.absent()
            )
        }.await()
        return RegisteredAccount.fromNew(account).also { accountStore.save(it) }
    }

    // provide a verification code, retrieve and store a UUID (storing account in db when done)
    suspend fun verify(account: RegisteredAccount, code: String): VerifiedAccount? {
        val verifyResponse: VerifyAccountResponse = try {
            app.coroutineScope.async(Concurrency.Dispatcher) {
                accountManagerOf(account).verifyAccountWithCode(
                    code,
                    null,
                    protocolStore.of(account).localRegistrationId,
                    true,
                    null,
                    null,
                    UnidentifiedAccess.deriveAccessKeyFrom(account.profileKey),
                    false,
                    AccountAttributes.Capabilities(true, false, false, false),
                    true
                )
            }.await()
        } catch(e: AuthorizationFailedException) {
            return null
        }
        val uuid = UUID.fromString(verifyResponse.uuid)
        // TODO(aguestuser|2020-12-23):
        //  - as a privacy matter, we might eventually want to throw away phone numbers once we have a UUID
        //  - if so, consider udpating `accountId` in protocol store to this uuid at this point?
        return VerifiedAccount.fromRegistered(account, uuid).also{ accountStore.save(it) }
    }



    /**
     * generate prekeys, store them locally and publish them to signal
     **/
    @Throws(IOException::class)
    suspend fun publishPreKeys(account: VerifiedAccount, preKeyIdOffset: Int = 0) {
        val store = protocolStore.of(account)
        return app.coroutineScope.async(Concurrency.Dispatcher) {
            // generate and store prekeys
            val signedPreKeyId = store.getLastSignedPreKeyId() + 1 % PREKEY_MAX_ID
            val signedPreKey = KeyUtil.genSignedPreKey(store.identityKeyPair, signedPreKeyId).also {
                store.storeSignedPreKey(it.id, it)
            }
            val oneTimePreKeys = KeyUtil.genPreKeys(preKeyIdOffset, PREKEY_BATCH_SIZE).also {
                store.storePreKeys(it)
            }
            // publish prekeys to signal server
            accountManagerOf(account).setPreKeys(store.identityKeyPair.publicKey, signedPreKey, oneTimePreKeys)
        }.await()
    }

    /**
     * check the server to see if our reserve of prekeys has been depleted, if so, replenish them
     **/
    @Throws(IOException::class)
    suspend fun refreshPreKeysIfDepleted(account: VerifiedAccount) {
        logger.info { "Checking whether to refresh prekeys for ${account.username}"}
        val numPreKeysOnServer = accountManagerOf(account).preKeysCount
        logger.debug { "Number of preKeys on server for ${account.username}: $numPreKeysOnServer"}
        if( numPreKeysOnServer >= PREKEY_MIN_RESERVE) return

        logger.info { "Refreshing prekeys for ${account.username}"}
        Metrics.AccountManager.numberOfPreKeyRefreshes.inc()
        val nextPreKeyId  = app.protocolStore.of(account).getLastPreKeyId() + 1
        return publishPreKeys(account, nextPreKeyId)
    }

    /**
     * Retrieve profile keys both for this account and a given contact, and use them to derive the
     * pair of sender-cert/delivery-token tuples necessary to send sealed-sender messages to the contact.
     * For details see:
     * - https://signal.org/blog/sealed-sender/
     * - https://0xacab.org/team-friendo/signalboost/-/issues/483
     **/
    @Throws(IOException::class) // if network call to retreive sender cert fails
    suspend fun getUnidentifiedAccessPair(accountId: String, contactId: String): UnidentifiedAccessPair? {
        val contactAccessKey = app.contactStore.loadProfileKey(accountId, contactId)?.let {
            UnidentifiedAccess.deriveAccessKeyFrom(it)
        } ?: run {
            logger.warn { "Could not derive delivery token for $contactId: no profile key found." }
            return null
        }

        val account = load(accountId)
        // TODO(aguestuser|2020-05-26):
        //  We could avoid a network call below by storing the sender cert locally and rotating it every 24 hours as per:
        //  https://github.com/signalapp/Signal-Android/blob/master/app/src/main/java/org/thoughtcrime/securesms/jobs/RotateCertificateJob.java
        val senderCert = accountManagerOf(account).senderCertificate
        val accountAccessKey = UnidentifiedAccess.deriveAccessKeyFrom(account.profileKey)

        return UnidentifiedAccessPair(
            UnidentifiedAccess(contactAccessKey, senderCert),
            UnidentifiedAccess(accountAccessKey, senderCert),
        )
    }
}


