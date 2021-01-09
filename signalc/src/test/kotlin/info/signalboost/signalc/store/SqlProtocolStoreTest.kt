package info.signalboost.signalc.store

import info.signalboost.signalc.db.*
import info.signalboost.signalc.testSupport.db.DatabaseConnection
import info.signalboost.signalc.testSupport.db.DatabaseConnection.initialize
import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.logic.KeyUtil
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.IdentityKeyStore.Direction
import org.whispersystems.libsignal.state.SessionRecord

class SqlProtocolStoreTest: FreeSpec({
    val db = DatabaseConnection.toPostgres().initialize()

    val accountId = genPhoneNumber()
    val store = SqlProtocolStore(db, accountId)
    val address = SignalProtocolAddress(accountId, 42)
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

    "Identities store" - {
        val identityKey = KeyUtil.genIdentityKeyPair().publicKey
        val rotatedIdentityKey = KeyUtil.genIdentityKeyPair().publicKey

        afterTest {
            store.removeIdentity(address)
            store.removeOwnIdentity()
        }

        "creates account's identity keypair on first call, retrieves it on subsequent calls" {
            transaction(db) { OwnIdentities.selectAll().count() shouldBe 0 }
            val keyPair = store.identityKeyPair
            transaction(db) { OwnIdentities.selectAll().count() shouldBe 1 }
            store.identityKeyPair.serialize() shouldBe keyPair.serialize()
        }

        "retrieves account's registration id on first call, retrieves it on subsquent calls" {
            transaction(db) { OwnIdentities.selectAll().count() } shouldBe 0
            val registrationId = store.localRegistrationId
            transaction(db) { OwnIdentities.selectAll().count() } shouldBe 1
            store.localRegistrationId shouldBe registrationId
        }

        "stores and retrieves an identity key" {
            store.saveIdentity(address, identityKey)
            store.getIdentity(address) shouldBe identityKey
        }

        "stores and retrieves the same identity key twice without error" {
            store.saveIdentity(address, identityKey)
            store.saveIdentity(address, identityKey)
            store.getIdentity(address) shouldBe identityKey
        }

        "trusts the first key it sees for an address" {
            store.isTrustedIdentity(address, identityKey, Direction.RECEIVING) shouldBe true
        }

        "trusts a key it has stored for an address" {
            store.saveIdentity(address, identityKey)
            store.isTrustedIdentity(address, identityKey, Direction.RECEIVING) shouldBe true
        }

        "trusts the same identity key for multiple devices" {
            store.saveIdentity(recipient.addresses[0], identityKey)
            store.saveIdentity(recipient.addresses[1], identityKey)

            store.isTrustedIdentity(recipient.addresses[0], identityKey, Direction.RECEIVING) shouldBe true
            store.isTrustedIdentity(recipient.addresses[1], identityKey, Direction.RECEIVING) shouldBe true
        }

        "does not trust an unknown identity key for an existing address" {
            store.saveIdentity(address, identityKey)
            store.isTrustedIdentity(address, rotatedIdentityKey, Direction.RECEIVING) shouldBe false
        }

        "does not trust an updated identity key for an existing address" {
            store.saveIdentity(address, identityKey)
            store.saveIdentity(address, rotatedIdentityKey)
            store.isTrustedIdentity(address, rotatedIdentityKey, Direction.RECEIVING) shouldBe false
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

        "stores and retrieves a *copy* of a session with an address" {
            store.storeSession(recipient.addresses[0], recipient.sessions[0])
            store.storeSession(recipient.addresses[1], recipient.sessions[1])
            val sessionCopy = store.loadSession(recipient.addresses[0])

            sessionCopy shouldNotBe  recipient.sessions[0] // it's a different object...
            sessionCopy.serialize() shouldBe recipient.sessions[0].serialize() // ...with same underlying values
        }

        "stores the same session record twice without error" {
            store.storeSession(recipient.addresses[0], recipient.sessions[0])
            store.storeSession(recipient.addresses[0], recipient.sessions[0])

            store.containsSession(recipient.addresses[0]) shouldBe true
        }

        "retrieves device ids for all sessions with a given user" {
            store.storeSession(recipient.addresses[0], recipient.sessions[0])
            store.storeSession(recipient.addresses[1], recipient.sessions[1])

            store.getSubDeviceSessions(recipient.phoneNumber) shouldBe listOf(0,1)
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
        val otherStore = SqlProtocolStore(db, otherAccountId)
        val ids = listOf(0,1)

        afterTest {
            store.removeOwnIdentity()
            store.removeIdentity(address)
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

            store.saveIdentity(address, KeyUtil.genIdentityKeyPair().publicKey)
            otherStore.saveIdentity(otherAddress, KeyUtil.genIdentityKeyPair().publicKey)

            store.getIdentity(address) shouldNotBe otherStore.getIdentity(otherAddress)
            store.getIdentity(otherAddress) shouldBe null
            otherStore.getIdentity(address) shouldBe null
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
})