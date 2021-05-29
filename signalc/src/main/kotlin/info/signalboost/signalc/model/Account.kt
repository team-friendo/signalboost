package info.signalboost.signalc.model

import info.signalboost.signalc.db.Accounts
import info.signalboost.signalc.util.KeyUtil.genPassword
import info.signalboost.signalc.util.KeyUtil.genProfileKeyBytes
import info.signalboost.signalc.util.KeyUtil.genSignalingKey
import org.jetbrains.exposed.sql.ResultRow
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.internal.util.DynamicCredentialsProvider
import java.util.*

sealed class Account {
    abstract val username: String
    abstract val password: String
    abstract val signalingKey: String // TODO: get rid of this! we never use it and it makes sd -> sc migration harder!
    abstract val profileKeyBytes: ByteArray
    abstract val deviceId: Int
    abstract val credentialsProvider: DynamicCredentialsProvider

    val profileKey: ProfileKey
      get() = ProfileKey(profileKeyBytes)

    val unverifiedCredentialsProvider: DynamicCredentialsProvider
      get() = DynamicCredentialsProvider(
          null,
          this.username,
          this.password,
          this.deviceId
      )

    // NOTE: we have to override equals/hashCode for all subclasses of Account b/c the `profileKey` field is a ByteArray
    // this is a base implementation that works for everything except `VerifiedAccount` (which must modify it to
    // also compare the UUID field that only it has).
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as Account

        if (username != other.username) return false
        if (password != other.password) return false
        if (signalingKey != other.signalingKey) return false
        if (!profileKeyBytes.contentEquals(other.profileKeyBytes)) return false
        if (deviceId != other.deviceId) return false

        return true
    }

    override fun hashCode(): Int {
        var result = username.hashCode()
        result = 31 * result + password.hashCode()
        result = 31 * result + signalingKey.hashCode()
        result = 31 * result + profileKeyBytes.contentHashCode()
        result = 31 * result + deviceId
        return result
    }
}


data class NewAccount(
    override val username: String,
    override val password: String = genPassword(),
    override val signalingKey: String = genSignalingKey(),
    override val profileKeyBytes: ByteArray = genProfileKeyBytes(),
    override val deviceId: Int = SignalServiceAddress.DEFAULT_DEVICE_ID,
): Account() {

    companion object {
        fun fromDb(row: ResultRow): NewAccount =
            NewAccount(
                row[Accounts.username],
                row[Accounts.password],
                row[Accounts.signalingKey],
                row[Accounts.profileKeyBytes],
                row[Accounts.deviceId],
            )
        // sometimes we might need to treat a RegisteredAccount like a NewAccount to re-register it!
        fun fromRegistered(account: RegisteredAccount): NewAccount = with(account) {
            NewAccount(
                username = username,
                password = password,
                signalingKey = signalingKey,
                profileKeyBytes = profileKeyBytes,
                deviceId = deviceId,
            )
        }
    }
    override val credentialsProvider: DynamicCredentialsProvider by lazy {
        unverifiedCredentialsProvider
    }

    override fun equals(other: Any?): Boolean {
        return super.equals(other)
    }

    override fun hashCode(): Int {
        return super.hashCode()
    }
}

data class RegisteredAccount(
    override val username: String,
    override val password: String,
    override val signalingKey: String,
    override val profileKeyBytes: ByteArray,
    override val deviceId: Int,
): Account() {

    companion object {
        fun fromNew(account: NewAccount): RegisteredAccount = with(account) {
            RegisteredAccount(
                username,
                password,
                signalingKey,
                profileKeyBytes,
                deviceId,
            )
        }

        fun fromDb(row: ResultRow): RegisteredAccount =
            RegisteredAccount(
                row[Accounts.username],
                row[Accounts.password],
                row[Accounts.signalingKey],
                row[Accounts.profileKeyBytes],
                row[Accounts.deviceId],
            )
    }

    override val credentialsProvider: DynamicCredentialsProvider by lazy {
       unverifiedCredentialsProvider
    }

    override fun equals(other: Any?): Boolean {
        return super.equals(other)
    }

    override fun hashCode(): Int {
        return super.hashCode()
    }
}

data class VerifiedAccount(
    val uuid: UUID,
    override val username: String,
    override val password: String,
    override val signalingKey: String,
    override val profileKeyBytes: ByteArray,
    override val deviceId: Int,
): Account(){

    companion object {
        fun fromRegistered(account: RegisteredAccount, uuid: UUID): VerifiedAccount = with(account) {
            VerifiedAccount(
                uuid,
                username,
                password,
                signalingKey,
                profileKeyBytes,
                deviceId,
            )
        }

        fun fromDb(row: ResultRow): VerifiedAccount =
            VerifiedAccount(
                row[Accounts.uuid]!!,
                row[Accounts.username],
                row[Accounts.password],
                row[Accounts.signalingKey],
                row[Accounts.profileKeyBytes],
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

    override fun equals(other: Any?): Boolean {
        return super.equals(other) &&  run {
            other as VerifiedAccount
            uuid == other.uuid
        }
    }

    override fun hashCode(): Int {
        return super.hashCode().let {
            31 * it + uuid.hashCode()
        }
    }

    // TODO(aguestuser|2021-05-26): refactor to prefer UUIDS instead of e164 numbers when/if we migrate off phone numbers!
    val id: String
      get() = username

    val address by lazy {
        SignalcAddress(username, uuid)
    }

    fun asSignalServiceAddress() = address.asSignalServiceAddress()
}