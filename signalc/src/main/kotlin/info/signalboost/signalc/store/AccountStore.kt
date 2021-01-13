package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.db.Accounts
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class AccountStore(private val db: Database) {

    enum class Status(val asString: String) {
        NEW("NEW"),
        REGISTERED("REGISTERED"),
        VERIFIED("VERIFIED"),
    }

    fun findOrCreate(username: String): Account =
        findByUsername(username) ?: create(NewAccount(username))

    internal fun create(account: NewAccount): Account = transaction(db) {
        // Throws if we try to create an already-existing account.
        // For this reason, we mark it `internal` and only call from `findOrCreate`
        // where we have a strong guarantee of not calling for an already-existing account.
        Accounts.insert {
            it[status] = Status.NEW.asString
            it[username] = account.username
            it[password] = account.password
            it[signalingKey] = account.signalingKey
            it[profileKey] = account.profileKey.serialize()
            it[deviceId] = account.deviceId
        }
    }.run { account }


    fun save(account: RegisteredAccount): RegisteredAccount = transaction(db) {
        Accounts.update({
            Accounts.username eq account.username
        }) {
            it[status] = Status.REGISTERED.asString
        }
    }.run { account }


    fun save(account: VerifiedAccount): VerifiedAccount = transaction(db) {
        Accounts.update({
            Accounts.username eq account.username
        }) {
            it[uuid] = account.uuid
            it[status] = Status.VERIFIED.asString
        }
    }.run { account }


    fun findByUsername(username: String): Account? =
        transaction(db) {
            Accounts.select {
                Accounts.username eq username
            }.singleOrNull()?.let {
                when (it[Accounts.status]) {
                    Status.NEW.asString -> NewAccount.fromDb(it)
                    Status.REGISTERED.asString -> RegisteredAccount.fromDb(it)
                    Status.VERIFIED.asString -> VerifiedAccount.fromDb(it)
                    else -> null // TODO: encode this as error!
                }
            }
        }

    fun findByUuid(uuid: UUID): VerifiedAccount? = transaction(db) {
        Accounts.select {
            Accounts.uuid eq uuid
        }.singleOrNull()?.let {
            VerifiedAccount.fromDb(it) 
        }
    }
}