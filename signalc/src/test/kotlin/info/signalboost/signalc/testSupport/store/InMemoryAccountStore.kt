package info.signalboost.signalc.testSupport.store

import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import java.util.*
import java.util.concurrent.ConcurrentHashMap

class InMemoryAccountStore {
    private val accounts: ConcurrentHashMap<String,Account> = ConcurrentHashMap()

    private fun store(account: Account) {
        accounts[account.username] = account
    }

    fun findOrCreate(username: String): Account =
        accounts[username] ?: NewAccount(username).also { save(it) }

    internal fun save(account: NewAccount) = store(account)
    fun save(account: RegisteredAccount) = store(account)
    fun save(account: VerifiedAccount) = store(account)

    fun findByUsername(username: String): Account? = accounts[username]
    fun findByUuid(uuid: UUID): VerifiedAccount? =
        accounts.values
            .find { it is VerifiedAccount && it.uuid == uuid }
            ?.let { it as VerifiedAccount }

    // testing helpers
    internal fun count(): Long = accounts.values.size.toLong()
    internal fun clear(): Int = accounts.values.size.also { accounts.clear() }

}