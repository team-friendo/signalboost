package info.signalboost.signalc.model

import info.signalboost.signalc.db.Accounts
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.util.KeyUtil.genPassword
import info.signalboost.signalc.util.KeyUtil.genProfileKey
import info.signalboost.signalc.util.KeyUtil.genSignalingKey
import org.jetbrains.exposed.sql.ResultRow
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.internal.util.DynamicCredentialsProvider
import java.util.*

sealed class Account {
    abstract val username: String
    abstract val password: String
    abstract val signalingKey: String
    // TODO(aguestuser|2021-05-26): consider storing profileKey as ByteArray
    //  then adding a (lazy?) property to access the object form
    //  why? we most often want the byte array and would like to avoid
    //  unnecessary serialization / deserialization roundtrips when a db call
    //  yields the already-deserialized version!
    abstract val profileKey: ProfileKey
    abstract val deviceId: Int
    abstract val credentialsProvider: DynamicCredentialsProvider

    val unverifiedCredentialsProvider: DynamicCredentialsProvider
      get() = DynamicCredentialsProvider(
          null,
          this.username,
          this.password,
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
            this.deviceId
        )
    }

    // TODO(aguestuser|2021-05-26): refactor to prefer UUIDS once we migrate off phone numbers!
    val id: String
      get() = username

    val address by lazy {
        SignalcAddress(username, uuid)
    }

    fun asSignalServiceAddress() = address.asSignalServiceAddress()
}