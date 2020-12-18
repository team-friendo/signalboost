package info.signalboost.signalc.store

import PreKeys
import info.signalboost.signalc.logic.KeyUtil
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.StdOutSqlLogger
import org.jetbrains.exposed.sql.addLogger
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.InvalidKeyException

class PostgresProtocolStoreTest: FreeSpec({
    // TODO: postgres not h2!!!
    val db = Database.connect(
        url ="jdbc:h2:mem:test;DB_CLOSE_DELAY=-1;",
        driver = "org.h2.Driver",
    )
    transaction(db) {
        addLogger(StdOutSqlLogger)
        SchemaUtils.create(PreKeys)
    }
    val store = PostgresProtocolStore(db)

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
})