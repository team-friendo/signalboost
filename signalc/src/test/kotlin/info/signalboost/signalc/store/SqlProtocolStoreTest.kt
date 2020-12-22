package info.signalboost.signalc.store

import info.signalboost.signalc.db.*
import info.signalboost.signalc.fixtures.PhoneNumber.genPhoneNumber
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
    // TODO (aguestuser|2020-12-18)
    //  replace h2 w/ postgres
    val db = Database.connect(
        url ="jdbc:h2:mem:test;DB_CLOSE_DELAY=-1;",
        driver = "org.h2.Driver",
    )
    transaction(db) {
        // uncomment to debug sql with extra logging!
        // addLogger(StdOutSqlLogger)
        SchemaUtils.create(Identities, OwnIdentities, PreKeys, SignedPreKeys, Sessions)
    }
    val accountId = genPhoneNumber()
    val store = SqlProtocolStore(db, accountId)
    val address = SignalProtocolAddress(accountId, 42)
    // NOTE: An address is a combination of a username (uuid or e164 num) and a device id.
    // This is how Signal represents the domain concept that a user may have many devices
    // and each device has its own session.
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

        "creates account's identity keypair on first call, retrieves it on subsequent calls" - {
            transaction(db) { OwnIdentities.selectAll().count() shouldBe 0 }
            val keyPair = store.identityKeyPair
            transaction(db) { OwnIdentities.selectAll().count() shouldBe 1 }
            store.identityKeyPair.serialize() shouldBe keyPair.serialize()
        }

        "retrieves account's registration id on first call, retrieves it on subsquent calls" - {
            transaction(db) { OwnIdentities.selectAll().count() } shouldBe 0
            val registrationId = store.localRegistrationId
            transaction(db) { OwnIdentities.selectAll().count() } shouldBe 1
            store.localRegistrationId shouldBe registrationId
        }

        "stores and retrieves an identity" - {
            store.saveIdentity(address, identityKey)
            store.getIdentity(address) shouldBe identityKey
        }

        "trusts the first key it sees for an address" - {
            store.isTrustedIdentity(address, identityKey, Direction.RECEIVING) shouldBe true
        }

        "trusts a key it has stored for an address" - {
            store.saveIdentity(address, identityKey)
            store.isTrustedIdentity(address, identityKey, Direction.RECEIVING) shouldBe true
        }

        "does not trust a new key for an existing address" - {
            store.saveIdentity(address, identityKey)
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

        "checks for prekey existence" - {
            store.containsPreKey(keyId) shouldBe false
        }

        "stores a prekey" - {
            store.storePreKey(keyId, prekey)
            store.containsPreKey(keyId) shouldBe true
        }

        "loads a prekey" - {
            store.storePreKey(keyId, prekey)
            val loadedKey = store.loadPreKey(keyId)
            loadedKey.serialize() shouldBe prekey.serialize()
        }

        "throws when trying to load a non-existent prekey" - {
            shouldThrow<InvalidKeyException> {
                store.loadPreKey(nonExistentId)
            }
        }

        "removes a prekey" - {
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

        "checks for existence of a signed prekey" - {
            store.containsPreKey(nonExistentId) shouldBe false
        }

        "stores a signed prekey" - {
            store.storeSignedPreKey(keyId, signedPrekey)
            store.containsSignedPreKey(keyId) shouldBe true
        }

        "loads a signed prekey" - {
            store.storeSignedPreKey(keyId, signedPrekey)
            store.loadSignedPreKey(keyId).serialize() shouldBe signedPrekey.serialize()
        }

        "throws when trying to load a non-existent signed prekey" - {
            shouldThrow<InvalidKeyException> {
                store.loadSignedPreKey(nonExistentId)
            }
        }

        "removes a signed prekey" - {
            store.storeSignedPreKey(keyId, signedPrekey)
            store.removeSignedPreKey(keyId)
            store.containsSignedPreKey(keyId) shouldBe false
        }
    }

    "Session Store" - {
        afterTest {
            store.deleteAllSessions(recipient.phoneNumber)
        }

        "checks for existence of a session with an address" - {
            store.containsSession(recipient.addresses[0]) shouldBe false
        }

        "stores and retrieves a *copy* of a session with an address" - {
            store.storeSession(recipient.addresses[0], recipient.sessions[0])
            store.storeSession(recipient.addresses[1], recipient.sessions[1])
            val sessionCopy = store.loadSession(recipient.addresses[0])

            sessionCopy shouldNotBe  recipient.sessions[0] // it's a different object...
            sessionCopy.serialize() shouldBe recipient.sessions[0].serialize() // ...with same underlying values
        }

        "retrieves device ids for all sessions with a given user" - {
            store.storeSession(recipient.addresses[0], recipient.sessions[0])
            store.storeSession(recipient.addresses[1], recipient.sessions[1])

            store.getSubDeviceSessions(recipient.phoneNumber) shouldBe listOf(0,1)
        }

        "deletes sessions across all devices for a given user" - {
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
            store.removeIdentity(address)
            store.removePreKey(ids[0])
            store.removeSignedPreKey(ids[0])
            store.deleteAllSessions(recipient.phoneNumber)

            otherStore.removeIdentity(otherAddress)
            otherStore.removePreKey(ids[0])
            otherStore.removeSignedPreKey(ids[0])
            otherStore.deleteAllSessions(recipient.phoneNumber)
        }

        "support separate and distinct identities" - {
            store.identityKeyPair.serialize() shouldNotBe otherStore.identityKeyPair.serialize()

            store.saveIdentity(address, KeyUtil.genIdentityKeyPair().publicKey)
            otherStore.saveIdentity(otherAddress, KeyUtil.genIdentityKeyPair().publicKey)

            store.getIdentity(address) shouldNotBe otherStore.getIdentity(otherAddress)
            store.getIdentity(otherAddress) shouldBe null
            otherStore.getIdentity(address) shouldBe null
        }

        "support separate and distinct prekeys" - {
            val prekeys = KeyUtil.genPreKeys(0, 2)

            store.storePreKey(ids[0], prekeys[0])
            otherStore.storePreKey(ids[1], prekeys[1])

            store.containsPreKey(ids[1]) shouldBe false
            otherStore.containsPreKey(ids[0]) shouldBe false
        }

        "support separate and distinct signed prekeys" - {
            val signedPreKeys = listOf(
                KeyUtil.genSignedPreKey(store.identityKeyPair, ids[0]),
                KeyUtil.genSignedPreKey(otherStore.identityKeyPair, ids[1]),
            )

            store.storeSignedPreKey(ids[0], signedPreKeys[0])
            otherStore.storeSignedPreKey(ids[1], signedPreKeys[1])

            store.containsPreKey(ids[1]) shouldBe false
            store.containsPreKey(ids[0]) shouldBe false
        }

        "support separate and distinct sessions" - {
            store.storeSession(recipient.addresses[0], recipient.sessions[0])
            otherStore.storeSession(recipient.addresses[1], recipient.sessions[1])

            store.containsSession(recipient.addresses[1]) shouldBe false
            otherStore.containsSession(recipient.addresses[0]) shouldBe false
        }
    }
})