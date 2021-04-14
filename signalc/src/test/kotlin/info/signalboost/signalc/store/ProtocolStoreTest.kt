package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalSender.Companion.asAddress
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.util.KeyUtil
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.SessionGen
import info.signalboost.signalc.testSupport.dataGenerators.SessionGen.genActiveSession
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
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
        val accountId = genPhoneNumber()
        val config = Config.mockAllExcept(ProtocolStore::class)
        val app = Application(config).run(testScope)
        val store = app.protocolStore.of(NewAccount(accountId))

        val senderOneAddress = SignalProtocolAddress(accountId, 42)
        val senderTwoAddress = SignalProtocolAddress(genPhoneNumber(), 15)
        // NOTE: An address is a combination of a username (uuid or e164-format phone number) and a device id.
        // This is how Signal represents that a user may have many devices and each device has its own session.
        val recipient = object {
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

        afterSpec {
            app.stop()
            testScope.teardown()
        }

        "Identities store" - {
            val identityKey = KeyUtil.genIdentityKeyPair().publicKey
            val rotatedIdentityKey = KeyUtil.genIdentityKeyPair().publicKey

            afterTest {
                store.removeIdentity(senderOneAddress)
                store.removeIdentity(senderTwoAddress)
                store.removeIdentity(recipient.addresses[0])
                store.removeIdentity(recipient.addresses[1])
                store.removeOwnIdentity()
            }

            "creates account's identity keypair on first call, retrieves it on subsequent calls" {
                app.protocolStore.countOwnIdentities() shouldBe 0
                val keyPair = store.identityKeyPair
                app.protocolStore.countOwnIdentities() shouldBe 1
                store.identityKeyPair.serialize() shouldBe keyPair.serialize()
            }

            "retrieves account's registration id on first call, retrieves it on subsquent calls" {
                app.protocolStore.countOwnIdentities() shouldBe 0
                val registrationId = store.localRegistrationId
                app.protocolStore.countOwnIdentities() shouldBe 1
                store.localRegistrationId shouldBe registrationId
            }

            "stores and retrieves an identity key" {
                store.saveIdentity(senderOneAddress, identityKey)
                store.getIdentity(senderOneAddress) shouldBe identityKey
            }

            "stores and retrieves the same identity key twice without error" {
                store.saveIdentity(senderOneAddress, identityKey)
                store.saveIdentity(senderOneAddress, identityKey)
                store.getIdentity(senderOneAddress) shouldBe identityKey
            }

            "updates the key for all identities with name + accountId" {
                store.saveIdentity(recipient.addresses[0], identityKey)
                store.saveIdentity(recipient.addresses[1], identityKey)
                store.saveFingerprintForAllIdentities(recipient.addresses[0].name.asAddress(), rotatedIdentityKey.serialize())
                store.getIdentity(recipient.addresses[0])!!.fingerprint shouldBe rotatedIdentityKey.fingerprint
                store.getIdentity(recipient.addresses[1])!!.fingerprint shouldBe rotatedIdentityKey.fingerprint
            }

            "trusts a key for all identities with the same fingerprint" {
                store.saveIdentity(senderOneAddress, identityKey)
                store.saveIdentity(senderTwoAddress, identityKey)
                store.saveIdentity(senderOneAddress, rotatedIdentityKey)
                store.saveIdentity(senderTwoAddress, rotatedIdentityKey)

                store.isTrustedIdentity(senderOneAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe false
                store.isTrustedIdentity(senderTwoAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe false

                store.trustFingerprintForAllIdentities(rotatedIdentityKey.serialize())

                store.isTrustedIdentity(senderOneAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe true
                store.isTrustedIdentity(senderTwoAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe true
            }

            "trusts the first key it sees for an address" {
                store.isTrustedIdentity(senderOneAddress, identityKey, Direction.RECEIVING) shouldBe true
            }

            "trusts a key it has stored for an address" {
                store.saveIdentity(senderOneAddress, identityKey)
                store.isTrustedIdentity(senderOneAddress, identityKey, Direction.RECEIVING) shouldBe true
            }

            "trusts the same identity key for multiple devices" {
                store.saveIdentity(recipient.addresses[0], identityKey)
                store.saveIdentity(recipient.addresses[1], identityKey)

                store.isTrustedIdentity(recipient.addresses[0], identityKey, Direction.RECEIVING) shouldBe true
                store.isTrustedIdentity(recipient.addresses[1], identityKey, Direction.RECEIVING) shouldBe true
            }

            "does not trust an unknown identity key for an existing address" {
                store.saveIdentity(senderOneAddress, identityKey)
                store.isTrustedIdentity(senderOneAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe false
            }

            "does not trust an updated identity key for an existing address" {
                store.saveIdentity(senderOneAddress, identityKey)
                store.saveIdentity(senderOneAddress, rotatedIdentityKey)
                store.isTrustedIdentity(senderOneAddress, rotatedIdentityKey, Direction.RECEIVING) shouldBe false
            }
        }


        "Prekey Store" - {
            val keyId = 42
            val nonExistentId = 1312
            val (prekey) = KeyUtil.genPreKeys(0, 1)

            afterTest {
                store.removePreKey(keyId)
            }

            "checks for prekey existence" {
                store.containsPreKey(keyId) shouldBe false
            }

            "stores a prekey" {
                store.storePreKey(keyId, prekey)
                store.containsPreKey(keyId) shouldBe true
            }

            "stores the same prekey twice without error" {
                store.storePreKey(keyId, prekey)
                store.storePreKey(keyId, prekey)
                store.containsPreKey(keyId) shouldBe true
            }

            "loads a prekey" {
                store.storePreKey(keyId, prekey)
                val loadedKey = store.loadPreKey(keyId)
                loadedKey.serialize() shouldBe prekey.serialize()
            }

            "throws when trying to load a non-existent prekey" {
                shouldThrow<InvalidKeyException> {
                    store.loadPreKey(nonExistentId)
                }
            }

            "removes a prekey" {
                store.storePreKey(keyId, prekey)
                store.containsPreKey(keyId) shouldBe true

                store.removePreKey(keyId)
                store.containsPreKey(keyId) shouldBe false
            }
        }

        "Signed prekey store" - {
            val keyId = 42
            val nonExistentId = 1312
            val signedPrekey = KeyUtil.genSignedPreKey(store.identityKeyPair, keyId)

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
        }

        "Session Store" - {
            afterTest {
                store.deleteAllSessions(recipient.phoneNumber)
            }

            "checks for existence of a session with an address" {
                store.containsSession(recipient.addresses[0]) shouldBe false
            }

            "checks that a session no longer exists after archiving" {
                val activeSessionRecord = SessionGen.genActiveSession()
                store.storeSession(recipient.addresses[0], activeSessionRecord)

                store.containsSession(recipient.addresses[0]) shouldBe true

                store.archiveSession(recipient.addresses[0])

                store.containsSession(recipient.addresses[0]) shouldBe false
            }

            "stores and retrieves a *copy* of a session with an address" {
                store.storeSession(recipient.addresses[0], recipient.sessions[0])
                store.storeSession(recipient.addresses[1], recipient.sessions[1])
                val sessionCopy = store.loadSession(recipient.addresses[0])

                sessionCopy shouldNotBe recipient.sessions[0] // it's a different object...
                sessionCopy.serialize() shouldBe recipient.sessions[0].serialize() // ...with same underlying values
            }

            "stores the same session record twice without error" {
                store.storeSession(recipient.addresses[0], genActiveSession())
                store.storeSession(recipient.addresses[0], genActiveSession())

                store.containsSession(recipient.addresses[0]) shouldBe true
            }

            "retrieves device ids for all sessions with a given user" {
                store.storeSession(recipient.addresses[0], recipient.sessions[0])
                store.storeSession(recipient.addresses[1], recipient.sessions[1])

                store.getSubDeviceSessions(recipient.phoneNumber) shouldBe listOf(0, 1)
            }

            "deletes sessions across all devices for a given user" {
                store.storeSession(recipient.addresses[0], recipient.sessions[0])
                store.storeSession(recipient.addresses[1], recipient.sessions[1])
                store.deleteAllSessions(recipient.phoneNumber)

                store.containsSession(recipient.addresses[0]) shouldBe false
                store.containsSession(recipient.addresses[1]) shouldBe false
                store.getSubDeviceSessions(recipient.phoneNumber) shouldBe emptyList()
            }
        }

        "Multiple stores" - {
            val otherAccountId = genPhoneNumber()
            val otherAddress = SignalProtocolAddress(otherAccountId, 10)
            val otherStore = app.protocolStore.of(NewAccount(otherAccountId))
            val ids = listOf(0, 1)

            afterTest {
                store.removeOwnIdentity()
                store.removeIdentity(senderOneAddress)
                store.removePreKey(ids[0])
                store.removeSignedPreKey(ids[0])
                store.deleteAllSessions(recipient.phoneNumber)

                otherStore.removeOwnIdentity()
                otherStore.removeIdentity(otherAddress)
                otherStore.removePreKey(ids[0])
                otherStore.removeSignedPreKey(ids[0])
                otherStore.deleteAllSessions(recipient.phoneNumber)
            }

            "support separate and distinct identities" {
                store.identityKeyPair.serialize() shouldNotBe otherStore.identityKeyPair.serialize()

                store.saveIdentity(senderOneAddress, KeyUtil.genIdentityKeyPair().publicKey)
                otherStore.saveIdentity(otherAddress, KeyUtil.genIdentityKeyPair().publicKey)

                store.getIdentity(senderOneAddress) shouldNotBe otherStore.getIdentity(otherAddress)
                store.getIdentity(otherAddress) shouldBe null
                otherStore.getIdentity(senderOneAddress) shouldBe null
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
                store.storeSession(recipient.addresses[0], recipient.sessions[0])
                otherStore.storeSession(recipient.addresses[1], recipient.sessions[1])

                store.containsSession(recipient.addresses[1]) shouldBe false
                otherStore.containsSession(recipient.addresses[0]) shouldBe false
            }
        }
    }
})
