package info.signalboost.signalc.model

import info.signalboost.signalc.Config.SIGNAL_AGENT
import info.signalboost.signalc.Config.groupsV2Operations
import info.signalboost.signalc.Config.signalServiceConfig
import info.signalboost.signalc.store.SignalcProtocolStore
import info.signalboost.signalc.logic.KeyUtil
import info.signalboost.signalc.logic.KeyUtil.genPassword
import info.signalboost.signalc.logic.KeyUtil.genProfileKey
import info.signalboost.signalc.logic.KeyUtil.genSignalingKey
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.libsignal.state.SignalProtocolStore
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceAccountManager
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
    // we provide different credentials based on whether we are registered or not
    abstract val asCredentialsProvider: DynamicCredentialsProvider

    // we use those credentials to make an account manager
    internal val asAccountManager: SignalServiceAccountManager
        get() = SignalServiceAccountManager(
            signalServiceConfig,
            this.asCredentialsProvider,
            SIGNAL_AGENT,
            groupsV2Operations,
            UptimeSleepTimer()
        )
}

class UnregisteredAccount(
    internal val username: String,
    internal val protocolStore: SignalProtocolStore = SignalcProtocolStore,
): Account() {

    /** FIELDS **/

    internal val password: String = genPassword(),
    internal val signalingKey: String = genSignalingKey(),
    internal val profileKey: ProfileKey = genProfileKey(),
    internal val deviceId: Int = SignalServiceAddress.DEFAULT_DEVICE_ID

    /** PROPERTIES **/

    private val unrestrictedAccesKey: ByteArray
        get() = UnidentifiedAccess.deriveAccessKeyFrom(this.profileKey)

    override val asCredentialsProvider: DynamicCredentialsProvider
        get() = DynamicCredentialsProvider(
            null,
            this.username,
            this.password,
            this.signalingKey,
            this.deviceId
        )

    /** METHODS **/

    // register an account with signal server and reqeust an sms token to use to verify it
    fun register() =
        this.asAccountManager.requestSmsVerificationCode(false, absent(), absent())

    // provide a verification code, retrieve and store a UUID
    fun verify(code: String): RegisteredAccount? {
        val verifyResponse: VerifyAccountResponse = try {
            this.asAccountManager.verifyAccountWithCode(
                code,
                null,
                protocolStore.localRegistrationId,
                true,
                null,
                null,
                this.unrestrictedAccesKey,
                false,
                SignalServiceProfile.Capabilities(true, false, false),
                true
            )
        } catch(e: AuthorizationFailedException) {
            return null
        }
        val uuid = UUID.fromString(verifyResponse.uuid)
        return RegisteredAccount.fromUnregisteredAccount(this, uuid)
    }
}

class RegisteredAccount(
    private val uuid: UUID,
    private val username: String,
    private val protocolStore: SignalProtocolStore,
    private val password: String,
    private val signalingKey: String,
    private val profileKey,
    private val deviceId: Int,
): Account() {

    companion object {
        fun fromUnregisteredAccount(unregistered: UnregisteredAccount, uuid: UUID) = RegisteredAccount(
            uuid,
            unregistered.username,
            unregistered.protocolStore,
            unregistered.password,
            unregistered.signalingKey,
            unregistered.profileKey,
            unregistered.deviceId,
        )
    }

    override val asCredentialsProvider: DynamicCredentialsProvider
        get() = DynamicCredentialsProvider(
            this.uuid,
            this.username,
            this.password,
            this.signalingKey,
            this.deviceId
        )

    // generate first set of prekeys, store them locally and publish them to whispersystems
    fun publishFirstPrekeys() {
        // generate prekeys and store them locally
        val signedPrekeyId = Random.nextInt(0, Integer.MAX_VALUE)
        val signedPreKey = KeyUtil.genSignedPreKey(SignalcProtocolStore.ownIdentityKeypair, signedPrekeyId).also {
            this.protocolStore.storeSignedPreKey(it.id, it)
        }
        val oneTimePreKeys = KeyUtil.genPreKeys(0, 100).onEach {
            this.protocolStore.storePreKey(it.id, it)
        }
        // publish prekeys to signal server
        this.asAccountManager.setPreKeys(
            this.protocolStore.identityKeyPair.publicKey,
            signedPreKey,
            oneTimePreKeys
        )
    }
}