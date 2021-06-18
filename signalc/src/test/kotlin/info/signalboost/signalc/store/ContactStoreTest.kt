package info.signalboost.signalc.store

import info.signalboost.signalc.util.KeyUtil.genRandomBytes
import com.zaxxer.hikari.HikariDataSource
import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuid
import info.signalboost.signalc.util.KeyUtil.genProfileKeyBytes
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.longs.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import org.jetbrains.exposed.exceptions.ExposedSQLException
import java.lang.IllegalStateException
import java.util.*
import kotlin.io.path.ExperimentalPathApi
import kotlin.properties.Delegates
import kotlin.time.ExperimentalTime

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class ContactStoreTest: FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(ContactStore::class, HikariDataSource::class)
        val app = Application(config).run(testScope)

        val accountId = genPhoneNumber()
        val contactProfileKey = genRandomBytes(32)
        val contactUpdatedProfileKey = genRandomBytes(32)

        afterSpec {
            app.stop()
            testScope.teardown()
        }

        "Contact store" - {
            afterTest {
                app.contactStore.deleteAllFor(accountId)
            }

            "#create" - {
                val initCount = app.contactStore.count()

                "given all fields for a contact" - {
                    val id = app.contactStore.create(accountId, genPhoneNumber(), genUuid(), genProfileKeyBytes())

                    "creates a contact and returns its id" {
                        id shouldBeGreaterThan 0
                        app.contactStore.count() shouldBeGreaterThan initCount
                    }
                }

                "given a phone number but no other fields" - {
                    val id = app.contactStore.create(accountId, genPhoneNumber(), null)

                    "creates a contact and returns its id" {
                        id shouldBeGreaterThan 0
                        app.contactStore.count() shouldBeGreaterThan initCount
                    }
                }

                "given a uuid but no other fields" - {
                    val id = app.contactStore.create(accountId, null, genUuid())

                    "creates a contact and returns its id" {
                        id shouldBeGreaterThan 0
                        app.contactStore.count() shouldBeGreaterThan initCount
                    }
                }

                "given no phone number or uuid" - {
                    "throws an illegal state exception" {
                        shouldThrow<IllegalStateException> {
                            app.contactStore.create(genPhoneNumber(), null, null)
                        }
                    }
                }
            }

            "#hasContact" - {
                val contactPhoneNumber = genPhoneNumber()
                val contactUuid = genUuid()

                beforeTest {
                    app.contactStore.create(accountId, contactPhoneNumber, contactUuid)
                }

                "true for the uuid of an existing contact" {
                    app.contactStore.hasContact(accountId, contactUuid.toString()) shouldBe true
                }

                "false for the uuid of a non-existent contact" {
                    app.contactStore.hasContact(accountId, genUuid().toString()) shouldBe false
                }

                "true for the phone number of an existing contact" {
                    app.contactStore.hasContact(accountId, contactPhoneNumber) shouldBe true
                }

                "false for the phone number of a non-existent contact" - {
                    app.contactStore.hasContact(accountId, genPhoneNumber()) shouldBe false
                }

                "false given a junk string" - {
                    app.contactStore.hasContact(accountId, "foo") shouldBe false
                }
            }

            "#resolveContactId" - {
                var contactPhoneNumber by Delegates.notNull<String>()
                var contactUuid by Delegates.notNull<UUID>()
                var contactId by Delegates.notNull<Int>()
                var initCount by Delegates.notNull<Long>()

                beforeTest {
                    contactPhoneNumber = genPhoneNumber()
                    contactUuid = genUuid()
                    contactId = app.contactStore.create(accountId, contactPhoneNumber, contactUuid)
                    initCount = app.contactStore.count()
                }

                "given the uuid of an existing contact" - {
                    app.contactStore.hasContact(accountId, contactUuid.toString()) shouldBe true

                    "returns the numeric id of that contact" {
                        app.contactStore.resolveContactId(accountId, contactUuid.toString()) shouldBe contactId
                        app.contactStore.count() shouldBe initCount
                    }
                }

                "given the uuid of a non-existent contact" - {
                    val newUuid = genUuid()
                    app.contactStore.hasContact(accountId, newUuid.toString()) shouldBe false

                    "creates a new contact with that uuid and returns its numeric id" {
                        app.contactStore.resolveContactId(accountId, newUuid.toString()) shouldBeGreaterThan  contactId
                        app.contactStore.count() shouldBeGreaterThan initCount
                        app.contactStore.hasContact(accountId, newUuid.toString()) shouldBe true
                    }
                }

                "given the phone number of an existing contact" - {
                    app.contactStore.hasContact(accountId, contactPhoneNumber) shouldBe true

                    "returns the numeric id of that contact" {
                        app.contactStore.resolveContactId(accountId, contactPhoneNumber) shouldBe contactId
                        app.contactStore.count() shouldBe initCount
                    }
                }

                "given the phone number for a non-existent contact" - {
                    val newPhoneNumber = genPhoneNumber()

                    "creates a new phone number with that uuid and returns its numeric id" {
                        app.contactStore.resolveContactId(accountId, newPhoneNumber) shouldBeGreaterThan contactId
                        app.contactStore.count() shouldBeGreaterThan initCount
                    }
                }
            }

            "#storeMissingIdentifier" - {
                val contactPhoneNumber = genPhoneNumber()
                val contactUuid = genUuid()

                "given a known phone number and a missing uuid" - {
                    app.contactStore.create(accountId, contactPhoneNumber, null)
                    app.contactStore.hasContact(accountId, contactUuid.toString()) shouldBe false

                    "stores the uuid" {
                        app.contactStore.storeMissingIdentifier(accountId, contactPhoneNumber, contactUuid)
                        app.contactStore.hasContact(accountId, contactUuid.toString()) shouldBe true
                    }
                }

                "given a known uuid and a missing phone number" - {
                    app.contactStore.create(accountId, null, contactUuid)
                    app.contactStore.hasContact(accountId, contactPhoneNumber) shouldBe false

                    "stores the phone number" {
                        app.contactStore.storeMissingIdentifier(accountId, contactPhoneNumber, contactUuid)
                        app.contactStore.hasContact(accountId, contactPhoneNumber) shouldBe true
                    }
                }

                "given an unknown uuid and an unknown phone number" - {
                    "throws IllegalStateException" {
                        shouldThrow<IllegalStateException> {
                            app.contactStore.storeMissingIdentifier(accountId, contactPhoneNumber, contactUuid)
                        }
                    }
                }
            }

            "#loadProfileKey" - {
                val contactId = genPhoneNumber()

                beforeTest {
                    app.contactStore.storeProfileKey(accountId, contactId, contactProfileKey)
                }

                "returns profile key for a contact if it exists" {
                    app.contactStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactProfileKey
                }

                "returns null if no profile key exists for contact" {
                    app.contactStore.loadProfileKey(accountId, genPhoneNumber()) shouldBe null
                }
            }

            "#storeProfileKey" - {
                val contactId = genPhoneNumber()

                "stores a new profile key for a new contact" {
                    val startingCount = app.contactStore.count()
                    app.contactStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.contactStore.count() shouldBe startingCount + 1
                    app.contactStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactProfileKey
                }

                "overwrites the old profile key for an existing contact" {
                    val startingCount = app.contactStore.count()
                    app.contactStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.contactStore.storeProfileKey(accountId, contactId, contactUpdatedProfileKey)
                    app.contactStore.count() shouldBe startingCount + 1
                    app.contactStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactUpdatedProfileKey
                }

                "safely stores the same profile key twice" {
                    val startingCount = app.contactStore.count()
                    app.contactStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.contactStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.contactStore.count() shouldBe startingCount + 1
                    app.contactStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactProfileKey
                }
            }
        }
    }
})