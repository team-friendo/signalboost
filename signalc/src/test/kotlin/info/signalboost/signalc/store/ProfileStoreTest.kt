package info.signalboost.signalc.store

import info.signalboost.signalc.util.KeyUtil.genRandomBytes
import org.signal.zkgroup.profiles.ProfileKey
import com.zaxxer.hikari.HikariDataSource
import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class ProfileStoreTest: FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(ProfileStore::class, HikariDataSource::class)
        val app = Application(config).run(testScope)

        val accountId = genPhoneNumber()
        val contactId = genPhoneNumber()
        val contactProfileKey = genRandomBytes(32)
        val contactUpdatedProfileKey = genRandomBytes(32)

        afterSpec {
            app.stop()
            testScope.teardown()
        }

        "Profile store" - {
            afterTest {
                app.profileStore.deleteAllFor(accountId)
            }

            "#loadProfileKey" - {
                beforeTest {
                    app.profileStore.storeProfileKey(accountId, contactId, contactProfileKey)
                }

                "returns profile key for a contact if it exists" {
                    app.profileStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactProfileKey
                }

                "returns null if no profile key exists for contact" {
                    app.profileStore.loadProfileKey(accountId, genPhoneNumber()) shouldBe null
                }
            }

            "#storeProfileKey" - {
                "stores a new profile key for a new contact" {
                    val startingCount = app.profileStore.count()
                    app.profileStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.profileStore.count() shouldBe startingCount + 1
                    app.profileStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactProfileKey
                }

                "overwrites the old profile key for an existing contact" {
                    val startingCount = app.profileStore.count()
                    app.profileStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.profileStore.storeProfileKey(accountId, contactId, contactUpdatedProfileKey)
                    app.profileStore.count() shouldBe startingCount + 1
                    app.profileStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactUpdatedProfileKey
                }

                "safely stores the same profile key twice" {
                    val startingCount = app.profileStore.count()
                    app.profileStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.profileStore.storeProfileKey(accountId, contactId, contactProfileKey)
                    app.profileStore.count() shouldBe startingCount + 1
                    app.profileStore.loadProfileKey(accountId, contactId)?.serialize() shouldBe contactProfileKey
                }
            }
        }
    }
})