package info.signalboost.signalc.model

import info.signalboost.signalc.Config.SIGNAL_AGENT
import info.signalboost.signalc.Config.groupsV2Operations
import info.signalboost.signalc.Config.signalServiceConfig
import info.signalboost.signalc.store.HashMapProtocolStore
import info.signalboost.signalc.logic.KeyUtil
import info.signalboost.signalc.logic.KeyUtil.genPassword
import info.signalboost.signalc.logic.KeyUtil.genProfileKey
import info.signalboost.signalc.logic.KeyUtil.genSignalingKey
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.libsignal.state.SignalProtocolStore
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccess
import org.whispersystems.signalservice.api.profiles.SignalServiceProfile
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.api.push.exceptions.AuthorizationFailedException
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import org.whispersystems.signalservice.internal.push.VerifyAccountResponse
import org.whispersystems.signalservice.internal.util.DynamicCredentialsProvider
import java.util.*
import kotlin.random.Random


sealed class Account {
    abstract val credentialsProvider: DynamicCredentialsProvider
    abstract val manager: SignalServiceAccountManager

    companion object {

        /** SHARED ACCOUNT OPERATIONS ***/

        fun accountManagerOf(account: Account) =
            SignalServiceAccountManager(
                signalServiceConfig,
                account.credentialsProvider,
                SIGNAL_AGENT,
                groupsV2Operations,
                UptimeSleepTimer()
            )

        /** UNREGISTERED ACCOUNT OPERATIONS **/

        // register an account with signal server and reqeust an sms token to use to verify it
        fun register(account: UnregisteredAccount) =
            account.manager.requestSmsVerificationCode(false, absent(), absent())

        // provide a verification code, retrieve and store a UUID
        fun verify(account: UnregisteredAccount, code: String): RegisteredAccount? {
            val verifyResponse: VerifyAccountResponse = try {
                account.manager.verifyAccountWithCode(
                    code,
                    null,
                    account.protocolStore.localRegistrationId,
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
    }
}

data class UnregisteredAccount(
    val username: String,
    val protocolStore: SignalProtocolStore = HashMapProtocolStore,
    val password: String = genPassword(),
    val signalingKey: String = genSignalingKey(),
    val profileKey: ProfileKey = genProfileKey(),
    val deviceId: Int = SignalServiceAddress.DEFAULT_DEVICE_ID,
): Account() {
    override val credentialsProvider by lazy {
        DynamicCredentialsProvider(
            null,
            this.username,
            this.password,
            this.signalingKey,
            this.deviceId
        )
    }

    override val manager by lazy {
        accountManagerOf(this)
    }
}

data class RegisteredAccount(
    val uuid: UUID,
    val username: String,
    val protocolStore: SignalProtocolStore,
    val password: String,
    val signalingKey: String,
    val profileKey: ProfileKey,
    val deviceId: Int,
): Account(){
    companion object {
        fun fromUnregisteredAccount(unregistered: UnregisteredAccount, uuid: UUID) = with(unregistered) {
            RegisteredAccount(
                uuid,
                username,
                protocolStore,
                password,
                signalingKey,
                profileKey,
                deviceId,
            )
        }

    }

    override val credentialsProvider by lazy {
        DynamicCredentialsProvider(
            this.uuid,
            this.username,
            this.password,
            this.signalingKey,
            this.deviceId
        )
    }

    override val manager by lazy {
        accountManagerOf(this)
    }

    val messageSender by lazy {
        SignalServiceMessageSender(
            signalServiceConfig,
            this.credentialsProvider,
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
}