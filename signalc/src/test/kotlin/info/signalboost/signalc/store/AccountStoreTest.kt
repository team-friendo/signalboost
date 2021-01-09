package info.signalboost.signalc.store

import info.signalboost.signalc.db.Accounts
import info.signalboost.signalc.testSupport.db.DatabaseConnection
import info.signalboost.signalc.testSupport.db.DatabaseConnection.initialize
import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beOfType
import org.jetbrains.exposed.exceptions.ExposedSQLException
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class AccountStoreTest : FreeSpec({
    val db = DatabaseConnection.toPostgres().initialize()
    val store = AccountStore(db)

    val username = genPhoneNumber()
    val newAccount = NewAccount(username)
    val registeredAccount = RegisteredAccount.fromNew(newAccount)
    val verifiedAccount = VerifiedAccount.fromRegistered(
        RegisteredAccount.fromNew(newAccount),
        UUID.randomUUID(),
    )

    fun countAccounts() = transaction(db) {  Accounts.selectAll().count() }

    afterTest {
        transaction(db) {
            Accounts.deleteAll()
        }
    }

    "#create" - {
        "given username for a non-existent account" - {
            "adds an account to the store" {
                val accountsCount = countAccounts()
                store.create(newAccount)
                countAccounts() shouldBe accountsCount + 1
            }
        }

        "given an existing account" - {
            "throws a SQL error and does not add a new account" {
                store.create(newAccount)
                val accountsCount = countAccounts()

                shouldThrow<ExposedSQLException>() {
                    store.create(newAccount)
                }
                countAccounts() shouldBe accountsCount
            }
        }
    }


    "#findOrCreate" - {
        fun countAccounts() = transaction(db) {  Accounts.selectAll().count() }

        "given username for a non-existent account" - {
            "adds an account to the store" {
                val accountsCount = countAccounts()
                store.findOrCreate(username)
                countAccounts() shouldBe accountsCount + 1
            }

            "returns a new account" {
                store.findOrCreate(username) should beOfType<NewAccount>()
            }
        }

        "given an existing account" - {
            "does not add a new account" {
                store.findOrCreate(username)
                val accountsCount = countAccounts()
                store.findOrCreate(username)
                countAccounts() shouldBe accountsCount
            }

            "returns the existing account" - {
                val originalAccount = store.findOrCreate(username)
                store.findOrCreate(username) shouldBe originalAccount
            }
        }
    }

    "#save" - {
        "given a registered account" - {
            store.create(newAccount)

            "updates the status of the account in the store" {
                store.save(registeredAccount)
                transaction(db) {
                    Accounts.select { Accounts.username eq username }.single()
                }[Accounts.status] shouldBe AccountStore.Status.REGISTERED.asString
            }

            "returns the account" {
                store.save(registeredAccount) shouldBe registeredAccount
            }
        }

        "given a verified account" - {
            store.create(newAccount)


            "updates the status of the account in the store" {
                store.save(verifiedAccount)
                transaction(db) {
                    Accounts.select { Accounts.username eq username }.single()
                }[Accounts.status] shouldBe AccountStore.Status.VERIFIED.asString
            }

            "returns the account" {
                store.save(verifiedAccount) shouldBe verifiedAccount
            }
        }
    }

    "#findByUserName" - {

        "given the username of a new account" - {
            store.create(newAccount)
            "returns a new account" {
                store.findByUsername(username) shouldBe newAccount
            }
        }

        "given the username of a registered account" - {
            store.create(newAccount)
            store.save(registeredAccount)

            "returns a registered account" {
                store.findByUsername(username) shouldBe registeredAccount
            }
        }

        "given the username of a verified account" - {
            store.create(newAccount)
            store.save(registeredAccount)
            store.save(verifiedAccount)

            "returns a registered account" {
                store.findByUsername(username) shouldBe verifiedAccount
            }
        }

        "#given a username for a non-existent account" - {
            "returns null" {
                store.findByUsername(genPhoneNumber()) shouldBe null
            }
        }
    }

    "#findByUuid" - {
        "given the uuid of a verified account" - {
            store.create(newAccount)
            store.save(registeredAccount)
            store.save(verifiedAccount)

            "returns the verified account" {
                store.findByUuid(verifiedAccount.uuid) shouldBe verifiedAccount
            }
        }

        "given the uuid of a non-existent account" - {
            "returns null" {
                store.findByUuid(UUID.randomUUID()) shouldBe null
            }
        }
    }
})
