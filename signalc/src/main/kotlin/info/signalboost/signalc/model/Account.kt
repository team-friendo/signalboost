package info.signalboost.signalc.model

import info.signalboost.signalc.Config.SIGNAL_AGENT
import info.signalboost.signalc.Config.groupsV2Operations
import info.signalboost.signalc.Config.signalServiceConfig
import info.signalboost.signalc.db.Accounts
import info.signalboost.signalc.logic.KeyUtil.genPassword
import info.signalboost.signalc.logic.KeyUtil.genProfileKey
import info.signalboost.signalc.logic.KeyUtil.genSignalingKey
import org.jetbrains.exposed.sql.ResultRow
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import org.whispersystems.signalservice.internal.util.DynamicCredentialsProvider
import java.util.*


sealed class Account {
    abstract val username: String
    abstract val password: String
    abstract val signalingKey: String
    abstract val profileKey: ProfileKey
    abstract val deviceId: Int
    abstract val credentialsProvider: DynamicCredentialsProvider

    val manager: SignalServiceAccountManager by lazy {
        SignalServiceAccountManager(
            signalServiceConfig,
            this.credentialsProvider,
            SIGNAL_AGENT,
            groupsV2Operations,
            UptimeSleepTimer()
        )
    }

    val unverifiedCredentialsProvider: DynamicCredentialsProvider
      get() = DynamicCredentialsProvider(
          null,
          this.username,
          this.password,
          this.signalingKey,
          this.deviceId
      )
}


data class NewAccount(
    override val username: String,
    override val password: String = genPassword(),
    override val signalingKey: String = genSignalingKey(),
    override val profileKey: ProfileKey = genProfileKey(),
    override val deviceId: Int = SignalServiceAddress.DEFAULT_DEVICE_ID,
): Account() {

    companion object {
        fun fromDb(row: ResultRow): NewAccount =
            NewAccount(
                row[Accounts.username],
                row[Accounts.password],
                row[Accounts.signalingKey],
                ProfileKey(row[Accounts.profileKey]),
                row[Accounts.deviceId],
            )
        // sometimes we might need to treat a RegisteredAccount like a NewAccount to re-register it!
        fun fromRegistered(account: RegisteredAccount): NewAccount = with(account) {
            NewAccount(
                username = username,
                password = password,
                signalingKey = signalingKey,
                profileKey = profileKey,
                deviceId = deviceId,
            )
        }
    }

    override val credentialsProvider: DynamicCredentialsProvider by lazy {
        unverifiedCredentialsProvider
    }
}

data class RegisteredAccount(
    override val username: String,
    override val password: String,
    override val signalingKey: String,
    override val profileKey: ProfileKey,
    override val deviceId: Int,
): Account() {

    companion object {
        fun fromNew(account: NewAccount): RegisteredAccount = with(account) {
            RegisteredAccount(
                username,
                password,
                signalingKey,
                profileKey,
                deviceId,
            )
        }

        fun fromDb(row: ResultRow): RegisteredAccount =
            RegisteredAccount(
                row[Accounts.username],
                row[Accounts.password],
                row[Accounts.signalingKey],
                ProfileKey(row[Accounts.profileKey]),
                row[Accounts.deviceId],
            )
    }

    override val credentialsProvider: DynamicCredentialsProvider by lazy {
       unverifiedCredentialsProvider
    }
}

data class VerifiedAccount(
    val uuid: UUID,
    override val username: String,
    override val password: String,
    override val signalingKey: String,
    override val profileKey: ProfileKey,
    override val deviceId: Int,
): Account(){

    companion object {
        fun fromRegistered(account: RegisteredAccount, uuid: UUID): VerifiedAccount = with(account) {
            VerifiedAccount(
                uuid,
                username,
                password,
                signalingKey,
                profileKey,
                deviceId,
            )
        }

        fun fromDb(row: ResultRow): VerifiedAccount =
            VerifiedAccount(
                row[Accounts.uuid]!!,
                row[Accounts.username],
                row[Accounts.password],
                row[Accounts.signalingKey],
                ProfileKey(row[Accounts.profileKey]),
                row[Accounts.deviceId],
            )
    }

    override val credentialsProvider: DynamicCredentialsProvider by lazy {
        DynamicCredentialsProvider(
            this.uuid,
            this.username,
            this.password,
            this.signalingKey,
            this.deviceId
        )
    }
}