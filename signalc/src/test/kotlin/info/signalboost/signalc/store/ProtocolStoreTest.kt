package info.signalboost.signalc.store

import com.zaxxer.hikari.HikariDataSource
import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.exception.SignalcError
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.SessionGen
import info.signalboost.signalc.testSupport.dataGenerators.SessionGen.genActiveSession
import info.signalboost.signalc.util.KeyUtil
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.comparables.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.IdentityKeyStore.Direction
import org.whispersystems.libsignal.state.SessionRecord
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class ProtocolStoreTest: FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(HikariDataSource::class, ProtocolStore::class, ContactStore::class)
        val app = Application(config).run(testScope)

        val accountId = genPhoneNumber()
        val accountAddress = SignalProtocolAddress(accountId, 42)
        // NOTE: An address is a combination of a username (uuid or e164-format phone number) and a device id.
        // This is how Signal represents that a user may have many devices and each device has its own session.
        val contact = object {
            val phoneNumber = genPhoneNumber()
            val addresses = listOf(
                SignalProtocolAddress(phoneNumber, 0),
                SignalProtocolAddress(phoneNumber, 1),
            )
            val sessions = listOf(
                SessionRecord(),
                SessionRecord(),
            )
        }
        val contactAddress = contact.addresses[0]
        val store = app.protocolStore.of(NewAccount(accountId))

        beforeSpec {
            app.contactStore.create(accountId, contact.phoneNumber, null)
        }
        afterSpec {
            app.stop()
            testScope.teardown()
        }

        "Identities store" - {
            val identityKey = KeyUtil.genIdentityKeyPair().publicKey
            val rotatedIdentityKey = KeyUtil.genIdentityKeyPair().publicKey

            afterTest {
                store.removeIdentity(accountAddress)
                store.removeIdentity(contact.addresses[0])
                store.removeIdentity(contact.addresses[1])
                store.removeOwnIdentity()
            }

            "creates account's identity keypair on first call, retrieves it on subsequent calls" {
                val startingCount = app.protocolStore.countOwnIdentities()
                val keyPair = store.identityKeyPair
                app.protocolStore.countOwnIdentities() shouldBe startingCount + 1
                store.identityKeyPair.serialize() shouldBe keyPair.serialize()
            }

            "retrieves account's registration id on first call, retrieves it on subsquent calls" {
                val startingCount = app.protocolStore.countOwnIdentities()
                val registrationId = store.localRegistrationId
                app.protocolStore.countOwnIdentities() shouldBe startingCount + 1
                store.localRegistrationId shouldBe registrationId
            }

            "stores and retrieves a contact's identity key" {
                store.saveIdentity(contactAddress, identityKey)
                store.getIdentity(contactAddress) shouldBe identityKey
            }

            "stores and retrieves the same identity key twice without error" {
                store.saveIdentity(contactAddress, identityKey)
                store.saveIdentity(contactAddress, identityKey)
                store.getIdentity(contactAddress) shouldBe identityKey
            }

            "only stores one identity per contact" {
                val startingCount = store.countIdentitities()
                store.saveIdentity(contact.addresses[0], identityKey)
                store.saveIdentity(contact.addresses[1], identityKey)
                store.countIdentitities() shouldBe startingCount + 1
            }

            "trusts the first key it sees for an address" {
                store.isTrustedIdentity(accountAddress, identityKey, Direction.RECEIVING) shouldBe true
            }

            "trusts a key it has stored for an address" {
                store.saveIdentity(accountAddress, identityKey)
                store.isTrustedIdentity(accountAddress, identityKey, Direction.RECEIVING) shouldBe true
            }

            "trusts the same identity key for multiple devices" {
                store.saveIdentity(contact.addresses[0], identityKey)

                store.isTrustedIdentity(contact.addresses[0], identityKey, Direction.RECEIVING) shouldBe true
                store.isTrustedIdentity(contact.addresses[1], identityKey, Direction.RECEIVING) shouldBe true
            }

            "does not trust an unknown identity key for an existing address" {
                store.saveIdentity(contactAddress, identityKey)
                store.isTrustedIdentity(contactAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe false
            }

            "saves a new identity key for a contact, causing the old identity key to become untrusted" {
                store.saveIdentity(contactAddress, identityKey)
                store.isTrustedIdentity(contactAddress, identityKey, Direction.RECEIVING) shouldBe true

                store.saveIdentity(contactAddress, rotatedIdentityKey)
                store.getIdentity(contactAddress)!!.fingerprint shouldBe rotatedIdentityKey.fingerprint

                store.isTrustedIdentity(contactAddress, identityKey, Direction.RECEIVING) shouldBe false
            }

            "increments the updatedAt field when saving a new identity key" {
                store.saveIdentity(contactAddress, identityKey)
                val whenFirstUpdated = store.whenIdentityLastUpdated(contactAddress)!!

                store.saveIdentity(contactAddress, rotatedIdentityKey)
                store.whenIdentityLastUpdated(contactAddress)!! shouldBeGreaterThan whenFirstUpdated
            }

            "udpates a known, untrusted identity key to become trusted" {
                store.saveIdentity(contactAddress, identityKey)
                store.isTrustedIdentity(contactAddress, identityKey, Direction.RECEIVING) shouldBe true

                store.saveIdentity(contactAddress, rotatedIdentityKey)
                store.isTrustedIdentity(contactAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe false

                store.trustFingerprint(contactAddress, rotatedIdentityKey.serialize())
                store.isTrustedIdentity(contactAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe true
            }

            "udpates a known, untrusted identity key to become untrusted" {
                store.saveIdentity(contactAddress, identityKey)
                store.isTrustedIdentity(contactAddress, identityKey, Direction.RECEIVING) shouldBe true

                store.untrustFingerprint(contactAddress, identityKey.serialize())
                store.isTrustedIdentity(contactAddress, identityKey, Direction.RECEIVING) shouldBe false
            }

            "throws if trying to update the trust an unknown (likely outdated) fingerprint for a known identity" {
                store.saveIdentity(contactAddress, rotatedIdentityKey)
                shouldThrow<SignalcError.UpdateToNonExistentFingerprint> {
                    store.trustFingerprint(contactAddress, identityKey.serialize())
                }
            }
        }


        "Prekey Store" - {
            val signedKeyId = 42
            val nonExistentId = 1312
            val prekeys = KeyUtil.genPreKeys(0, 2)
            val prekey = prekeys[0]

            afterTest {
                prekeys.forEach { store.removePreKey(it.id) }
            }

            "checks for prekey existence" {
                store.containsPreKey(prekey.id) shouldBe false
            }

            "stores a prekey" {
                store.storePreKey(prekey.id, prekey)
                store.containsPreKey(prekey.id) shouldBe true
            }

            "stores the same prekey twice without error" {
                store.storePreKey(prekey.id, prekey)
                store.storePreKey(prekey.id, prekey)
                store.containsPreKey(prekey.id) shouldBe true
            }

            "stores many prekeys in a batch" {
                store.storePreKeys(prekeys)
                prekeys.forEach {
                    store.containsPreKey(it.id) shouldBe true
                }
            }

            "loads a prekey" {
                store.storePreKey(prekey.id, prekey)
                val loadedKey = store.loadPreKey(prekey.id)
                loadedKey.serialize() shouldBe prekey.serialize()
            }

            "throws when trying to load a non-existent prekey" {
                shouldThrow<InvalidKeyException> {
                    store.loadPreKey(nonExistentId)
                }
            }

            "removes a prekey" {
                store.storePreKey(prekey.id, prekey)
                store.containsPreKey(prekey.id) shouldBe true

                store.removePreKey(prekey.id)
                store.containsPreKey(prekey.id) shouldBe false
            }

            "retrieves the last-created profile key id" {
                prekeys.forEach { store.storePreKey(it.id, it) }
                store.getLastPreKeyId() shouldBe prekeys.last().id
            }
        }

        "Signed prekey store" - {
            val keyId = 42
            val nonExistentId = 1312
            val signedPrekey = KeyUtil.genSignedPreKey(store.identityKeyPair, keyId)
            val otherSignedPreKey = KeyUtil.genSignedPreKey(store.identityKeyPair, keyId + 1)

            afterTest {
                store.removeSignedPreKey(keyId)
            }

            "checks for existence of a signed prekey" {
                store.containsPreKey(nonExistentId) shouldBe false
            }

            "stores a signed prekey" {
                store.storeSignedPreKey(keyId, signedPrekey)
                store.containsSignedPreKey(keyId) shouldBe true
            }

            "stores the same signed prekey twice without error" {
                store.storeSignedPreKey(keyId, signedPrekey)
                store.storeSignedPreKey(keyId, signedPrekey)
                store.containsSignedPreKey(keyId) shouldBe true
            }

            "loads a signed prekey" {
                store.storeSignedPreKey(keyId, signedPrekey)
                store.loadSignedPreKey(keyId).serialize() shouldBe signedPrekey.serialize()
            }

            "throws when trying to load a non-existent signed prekey" {
                shouldThrow<InvalidKeyException> {
                    store.loadSignedPreKey(nonExistentId)
                }
            }

            "removes a signed prekey" {
                store.storeSignedPreKey(keyId, signedPrekey)
                store.removeSignedPreKey(keyId)
                store.containsSignedPreKey(keyId) shouldBe false
            }

            "retrieves the last-created profile key id" {
                store.storeSignedPreKey(signedPrekey.id, signedPrekey)
                store.storeSignedPreKey(otherSignedPreKey.id, otherSignedPreKey)
                store.getLastSignedPreKeyId() shouldBe otherSignedPreKey.id
            }
        }

        "Session Store" - {
            afterTest {
                store.deleteAllSessions(contact.phoneNumber)
            }

            "checks for existence of a session with an address" {
                store.containsSession(contact.addresses[0]) shouldBe false
            }

            "checks that a session no longer exists after archiving" {
                val activeSessionRecord = SessionGen.genActiveSession()
                store.storeSession(contact.addresses[0], activeSessionRecord)

                store.containsSession(contact.addresses[0]) shouldBe true

                store.archiveSession(contact.addresses[0])

                store.containsSession(contact.addresses[0]) shouldBe false
            }

            "stores and retrieves a *copy* of a session with an address" {
                store.storeSession(contact.addresses[0], contact.sessions[0])
                store.storeSession(contact.addresses[1], contact.sessions[1])
                val sessionCopy = store.loadSession(contact.addresses[0])

                sessionCopy shouldNotBe contact.sessions[0] // it's a different object...
                sessionCopy.serialize() shouldBe contact.sessions[0].serialize() // ...with same underlying values
            }

            "stores the same session record twice without error" {
                store.storeSession(contact.addresses[0], genActiveSession())
                store.storeSession(contact.addresses[0], genActiveSession())

                store.containsSession(contact.addresses[0]) shouldBe true
            }

            "retrieves device ids for all sessions with a given user" {
                store.storeSession(contact.addresses[0], contact.sessions[0])
                store.storeSession(contact.addresses[1], contact.sessions[1])

                store.getSubDeviceSessions(contact.phoneNumber) shouldBe listOf(0, 1)
            }

            "deletes sessions across all devices for a given user" {
                store.storeSession(contact.addresses[0], contact.sessions[0])
                store.storeSession(contact.addresses[1], contact.sessions[1])
                store.deleteAllSessions(contact.phoneNumber)

                store.containsSession(contact.addresses[0]) shouldBe false
                store.containsSession(contact.addresses[1]) shouldBe false
                store.getSubDeviceSessions(contact.phoneNumber) shouldBe emptyList()
            }
        }

        "Multiple stores" - {
            val otherAccountId = genPhoneNumber()
            val otherAddress = SignalProtocolAddress(otherAccountId, 10)
            val otherStore = app.protocolStore.of(NewAccount(otherAccountId))
            val ids = listOf(0, 1)

            afterTest {
                store.removeOwnIdentity()
                store.removeIdentity(accountAddress)
                store.removePreKey(ids[0])
                store.removeSignedPreKey(ids[0])
                store.deleteAllSessions(contact.phoneNumber)

                otherStore.removeOwnIdentity()
                otherStore.removeIdentity(otherAddress)
                otherStore.removePreKey(ids[0])
                otherStore.removeSignedPreKey(ids[0])
                otherStore.deleteAllSessions(contact.phoneNumber)
            }

            "support separate and distinct identities" {
                store.identityKeyPair.serialize() shouldNotBe otherStore.identityKeyPair.serialize()

                store.saveIdentity(accountAddress, KeyUtil.genIdentityKeyPair().publicKey)
                otherStore.saveIdentity(otherAddress, KeyUtil.genIdentityKeyPair().publicKey)

                store.getIdentity(accountAddress) shouldNotBe otherStore.getIdentity(otherAddress)
                store.getIdentity(otherAddress) shouldBe null
                otherStore.getIdentity(accountAddress) shouldBe null
            }

            "support separate and distinct prekeys" {
                val prekeys = KeyUtil.genPreKeys(0, 2)

                store.storePreKey(ids[0], prekeys[0])
                otherStore.storePreKey(ids[1], prekeys[1])

                store.containsPreKey(ids[1]) shouldBe false
                otherStore.containsPreKey(ids[0]) shouldBe false
            }

            "support separate and distinct signed prekeys" {
                val signedPreKeys = listOf(
                    KeyUtil.genSignedPreKey(store.identityKeyPair, ids[0]),
                    KeyUtil.genSignedPreKey(otherStore.identityKeyPair, ids[1]),
                )

                store.storeSignedPreKey(ids[0], signedPreKeys[0])
                otherStore.storeSignedPreKey(ids[1], signedPreKeys[1])

                store.containsPreKey(ids[1]) shouldBe false
                store.containsPreKey(ids[0]) shouldBe false
            }

            "support separate and distinct sessions" {
                store.storeSession(contact.addresses[0], contact.sessions[0])
                otherStore.storeSession(contact.addresses[1], contact.sessions[1])

                store.containsSession(contact.addresses[1]) shouldBe false
                otherStore.containsSession(contact.addresses[0]) shouldBe false
            }
        }
    }
})
