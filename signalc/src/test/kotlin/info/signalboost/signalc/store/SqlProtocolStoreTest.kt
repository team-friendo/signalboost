package info.signalboost.signalc.store

import info.signalboost.signalc.db.*
import info.signalboost.signalc.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.logic.KeyUtil
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.beOfType
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.IdentityKeyStore
import org.whispersystems.libsignal.state.IdentityKeyStore.Direction
import org.whispersystems.libsignal.state.SessionRecord

class SqlProtocolStoreTest: FreeSpec({
    // TODO (aguestuser|2020-12-18)
    //  (1) test that different accounts can have different stores with their own values
    //  (2) replace h2 w/ postgres
    val db = Database.connect(
        url ="jdbc:h2:mem:test;DB_CLOSE_DELAY=-1;",
        driver = "org.h2.Driver",
    )
    transaction(db) {
        // uncomment to debug sql with extra logging!
        // addLogger(StdOutSqlLogger)
        SchemaUtils.create(Identities, OwnIdentities, PreKeys, SignedPreKeys, Sessions)
    }
    val store = SqlProtocolStore(db, genPhoneNumber())

    "Identities store" - {
        val address = SignalProtocolAddress("+12223334444", 42)
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
        val prekey = KeyUtil.genPreKeys(0, 1)[0]

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
        // NOTE: An address is a combination of a username (uuid or e164 num) and a device id.
        // This is how Signal represents the domain concept that a user may have many devices

        val phoneNumber = "+12223334444"
        val address1 = SignalProtocolAddress(phoneNumber, 1)
        val address1Session = SessionRecord()
        val address2 = SignalProtocolAddress(phoneNumber, 2)
        val address2Session = SessionRecord()

        afterTest {
            store.deleteAllSessions(phoneNumber)
        }

        "checks for existence of a session with an address" - {
            store.containsSession(address1) shouldBe false
        }

        "stores and retrieves a *copy* of a session with an address" - {
            store.storeSession(address1, address1Session)
            val sessionCopy = store.loadSession(address1)

            sessionCopy shouldNotBe  address1Session // it's a different object...
            sessionCopy.serialize() shouldBe address1Session.serialize() // ...with same underlying values
        }

        "retrieves device ids for all sessions with a given user" - {
            store.storeSession(address1, address1Session)
            store.storeSession(address2, address2Session)

            store.getSubDeviceSessions(phoneNumber) shouldBe listOf(1,2)
        }

        "deletes sessions across all devices for a given user" - {
            store.storeSession(address1, address1Session)
            store.storeSession(address2, address2Session)
            store.deleteAllSessions(phoneNumber)

            store.containsSession(address1) shouldBe false
            store.containsSession(address2) shouldBe false
            store.getSubDeviceSessions(phoneNumber) shouldBe emptyList()
        }
    }
})