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
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import org.whispersystems.signalservice.internal.util.DynamicCredentialsProvider
import java.util.*

// TODO: make UnregisteredAccount / RegisteredAccount ADT variants & eliminate var fields?
class Account(
    private val username: String,
    private val protocolStore: SignalProtocolStore = SignalcProtocolStore
) {
    /****** FIELDS ******/

    private var uuid: UUID? = null // assigned after registration

    private val password: String = genPassword()
    private val signalingKey: String = genSignalingKey()
    private val profileKey: ProfileKey = genProfileKey()
    private val deviceId: Int = SignalServiceAddress.DEFAULT_DEVICE_ID

    /****** PROPERTIES ******/

    private val unrestrictedAccesKey: ByteArray
        get() = UnidentifiedAccess.deriveAccessKeyFrom(this.profileKey)

    val asCredentialsProvider: DynamicCredentialsProvider
        get() = DynamicCredentialsProvider(
            this.uuid,
            this.username,
            this.password,
            this.signalingKey,
            this.deviceId
        )

    private val asAccountManager: SignalServiceAccountManager
        get() = SignalServiceAccountManager(
            signalServiceConfig,
            this.asCredentialsProvider,
            SIGNAL_AGENT,
            groupsV2Operations,
            UptimeSleepTimer()
        )

    /****** METHODS ******/

    // register an account with signal server and reqeust an sms token to use to verify it
    fun register() =
        this.asAccountManager.requestSmsVerificationCode(false, absent(), absent())

    // provide a verification code, retrieve and store a UUID
    fun verify(protocolStore: SignalProtocolStore, code: String): Boolean {
        // TODO: more granular failure/succes signaling in return value?
        val verifyResponse = this.asAccountManager.verifyAccountWithCode(
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
        verifyResponse.uuid ?: return false
        this.uuid = UUID.fromString(verifyResponse.uuid)
        return true
    }

    // generate first set of prekeys, store them locally and publish them to whispersystems
    fun publishFirstPrekeys() {
        // generate prekeys and store them locally
        val oneTimePreKeys = KeyUtil.genPreKeys(0, 100).onEach {
            this.protocolStore.storePreKey(it.id, it)
        }
        val signedPrekeyId = 42 // TODO: randomize this? store it on the account?
        val signedPreKey = KeyUtil.genSignedPreKey(SignalcProtocolStore.ownIdentityKeypair, signedPrekeyId).also {
            this.protocolStore.storeSignedPreKey(it.id, it)
        }
        // publish prekeys to signal server
        this.asAccountManager.setPreKeys(
            this.protocolStore.identityKeyPair.publicKey,
            signedPreKey,
            oneTimePreKeys
        )
    }
}

