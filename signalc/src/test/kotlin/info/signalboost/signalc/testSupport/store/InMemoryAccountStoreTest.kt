package info.signalboost.signalc.testSupport.store

import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beOfType
import java.util.*

class InMemoryAccountStoreTest : FreeSpec({
    val store = InMemoryAccountStore()

    val username = genPhoneNumber()
    val newAccount = NewAccount(username)
    val registeredAccount = RegisteredAccount.fromNew(newAccount)
    val verifiedAccount = VerifiedAccount.fromRegistered(
        RegisteredAccount.fromNew(newAccount),
        UUID.randomUUID(),
    )

    afterTest {
        store.clear()
    }


    "#findOrCreate" - {

        "given username for a non-existent account" - {
            "adds an account to the store" {
                val accountsCount = store.count()
                store.findOrCreate(username)
                store.count() shouldBe accountsCount + 1
            }

            "returns a new account" {
                store.findOrCreate(username) should beOfType<NewAccount>()
            }
        }

        "given an existing account" - {
            "does not add a new account" {
                store.findOrCreate(username)
                val accountsCount = store.count()
                store.findOrCreate(username)
                store.count() shouldBe accountsCount
            }

            "returns the existing account" - {
                val originalAccount = store.findOrCreate(username)
                store.findOrCreate(username) shouldBe originalAccount
            }
        }
    }

    "#save" - {
        "given a registered account" - {
            store.save(newAccount)

            "updates the status of the account in the store" {
                store.findByUsername(username) shouldBe newAccount
                store.save(registeredAccount)
                store.findByUsername(username) shouldBe registeredAccount
            }
        }

        "given a verified account" - {
            store.save(newAccount)

            "updates the status of the account in the store" {
                store.findByUsername(username) shouldBe newAccount
                store.save(verifiedAccount)
                store.findByUsername(username) shouldBe verifiedAccount
            }
        }
    }

    "#findByUserName" - {

        "given the username of a new account" - {
            store.save(newAccount)
            "returns a new account" {
                store.findByUsername(username) shouldBe newAccount
            }
        }

        "given the username of a registered account" - {
            store.save(newAccount)
            store.save(registeredAccount)

            "returns a registered account" {
                store.findByUsername(username) shouldBe registeredAccount
            }
        }

        "given the username of a verified account" - {
            store.save(newAccount)
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
            store.save(newAccount)
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