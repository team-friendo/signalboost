package info.signalboost.signalc.logic


import info.signalboost.signalc.Application
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.KeyUtil
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.Default
import kotlinx.coroutines.Dispatchers.IO
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccess
import org.whispersystems.signalservice.api.profiles.SignalServiceProfile
import org.whispersystems.signalservice.api.push.exceptions.AuthorizationFailedException
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import org.whispersystems.signalservice.internal.push.VerifyAccountResponse
import java.util.UUID
import kotlin.random.Random
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class AccountManager(private val app: Application) {

    private val accountStore = app.accountStore
    private val protocolStore = app.protocolStore
    private val signal = app.signal

    private val accountManagers:  MutableMap<Account,SignalServiceAccountManager> = mutableMapOf()

    private fun accountManagerOf(account: Account): SignalServiceAccountManager {
        // Return a Signal account manager instance for an account.
        // For verified accounts, return or create memoized references to account managers.
        val createAccountManager =  {
            SignalServiceAccountManager(
                signal.configs,
                account.credentialsProvider,
                signal.agent,
                signal.groupsV2Operations,
                UptimeSleepTimer()
            )
        }
        return when(account) {
            is VerifiedAccount -> accountManagers[account] ?: createAccountManager()
            else -> createAccountManager()
        }
    }

    suspend fun load(accountId: String): Account = accountStore.findOrCreate(accountId)

    suspend fun loadVerified (accountId: String): VerifiedAccount? =
        when(val acc = accountStore.findOrCreate(accountId)) {
            is VerifiedAccount -> acc
            else -> null
        }


    // register an account with signal server and request an sms token to use to verify it (storing account in db)
    suspend fun register(account: NewAccount, captchaToken: String? = null): RegisteredAccount {
        app.coroutineScope.async {
            accountManagerOf(account).requestSmsVerificationCode(
                false,
                captchaToken?.let { Optional.of(it) } ?: Optional.absent(),
                Optional.absent()
            )
        }.await()
        return RegisteredAccount.fromNew(account).also { accountStore.save(it) }
    }

    // provide a verification code, retrieve and store a UUID (storing account in db when done)
    suspend fun verify(account: RegisteredAccount, code: String): VerifiedAccount? {
        val verifyResponse: VerifyAccountResponse = try {
            app.coroutineScope.async {
                accountManagerOf(account).verifyAccountWithCode(
                    code,
                    null,
                    protocolStore.of(account).localRegistrationId,
                    true,
                    null,
                    null,
                    UnidentifiedAccess.deriveAccessKeyFrom(account.profileKey),
                    false,
                    SignalServiceProfile.Capabilities(true, false, false),
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

    // generate prekeys, store them locally and publish them to signal
    suspend fun publishPreKeys(account: VerifiedAccount): VerifiedAccount {
        val accountProtocolStore = protocolStore.of(account)
        return app.coroutineScope.async {
            withContext(Default) {
                // generate prekeys on CPU-friendly dispatcher
                val signedPrekeyId = Random.nextInt(0, Integer.MAX_VALUE) // TODO: use an incrementing int here?
                val signedPreKey = KeyUtil.genSignedPreKey(accountProtocolStore.identityKeyPair, signedPrekeyId)
                val oneTimePreKeys = KeyUtil.genPreKeys(0, 100)
                withContext(IO) {
                    // switch to IO-friendly dispatcher to...
                    // store prekeys
                    accountProtocolStore.storeSignedPreKey(signedPreKey.id,signedPreKey)
                    oneTimePreKeys.onEach { accountProtocolStore.storePreKey(it.id, it) }
                    // publish prekeys to signal server
                    accountManagerOf(account).setPreKeys(
                        accountProtocolStore.identityKeyPair.publicKey,
                        signedPreKey,
                        oneTimePreKeys
                    )
                    account
                }
            }
        }.await()
    }
}


