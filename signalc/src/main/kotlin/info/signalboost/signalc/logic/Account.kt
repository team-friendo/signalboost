package info.signalboost.signalc.logic

import info.signalboost.signalc.Config.SIGNAL_AGENT
import info.signalboost.signalc.Config.groupsV2Operations
import info.signalboost.signalc.Config.signalServiceConfig
import info.signalboost.signalc.logic.KeyUtil.genPassword
import info.signalboost.signalc.logic.KeyUtil.genProfileKey
import info.signalboost.signalc.logic.KeyUtil.genSignalingKey
import info.signalboost.signalc.store.HashMapProtocolStore
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.libsignal.state.SignalProtocolStore
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import org.whispersystems.signalservice.internal.util.DynamicCredentialsProvider
import java.util.*


sealed class Account {
    abstract val credentialsProvider: DynamicCredentialsProvider
    abstract val manager: SignalServiceAccountManager

    companion object {
        fun Account.asSignalAccountManager(): SignalServiceAccountManager =
            SignalServiceAccountManager(
                signalServiceConfig,
                this.credentialsProvider,
                SIGNAL_AGENT,
                groupsV2Operations,
                UptimeSleepTimer()
            )
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
        this.asSignalAccountManager()
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
        this.asSignalAccountManager()
    }
}