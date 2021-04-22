package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.serialization.EnvelopeSerializer.toByteArray
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuid
import info.signalboost.signalc.testSupport.dataGenerators.EnvelopeGen.genEnvelope
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beOfType
import io.mockk.every
import io.mockk.mockkConstructor
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import org.jetbrains.exposed.dao.id.EntityID
import java.util.*
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class EnvelopeStoreTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(EnvelopeStore::class)
        val app = Application(config).run(this)
        val store = app.envelopeStore

        val accountId = genPhoneNumber()
        val envelope = genEnvelope()

        afterTest {
            store.clear()
        }

        afterSpec {
            app.stop()
            testScope.teardown()
        }

        "#create" - {
            "given a new envelope and its timestamp" - {
                val startingCount = store.count()

                "adds an envelope to the store and returns its UUID" {
                    store.create(accountId, envelope) should beOfType<UUID>()
                    store.count() shouldBe startingCount + 1
                    store.findAll(accountId)[0].let {
                        it.toByteArray() shouldBe envelope.toByteArray()
                        it.serverDeliveredTimestamp shouldBe envelope.serverDeliveredTimestamp
                    }
                }
             }

            "given an existing envelope and its timestamp" - {
                val startingCount = store.count()

                "caches the envelope again" {
                    store.create(accountId, envelope)
                    store.create(accountId, envelope)
                    store.count() shouldBe startingCount + 2
                }
            }

            "when some random db error happens" - {
                // NOTE(aguestuser|2021-04-21): yes, this is a very weird test!! sorry!!!
                // i tried mocking `Envelopes.insertAndGetId` but ran into all sorts of weird runtime
                // type errors when mockk could not resolve the right kind of `Function2` blah blah
                // so this seems like a random enough error to prove the point!
                mockkConstructor(EntityID::class)
                every {
                    anyConstructed<EntityID<UUID>>().value
                } throws Error("BOOM!")

                "returns null" {
                    store.create(accountId, envelope) shouldBe null
                }
            }
        }

        "#delete" - {
            "given the UUID of an existing envelope" - {
                val cacheId = store.create(accountId, genEnvelope())!!
                val startingCount = store.count()

                "deletes the envelope from the store" {
                    store.count() shouldBe startingCount
                    store.delete(cacheId)
                    store.count() shouldBe startingCount - 1
                }
            }

            "given the UUID of a non-existing envelope" - {
                store.create(accountId, genEnvelope())
                val startingCount = store.count()

                "does nothing" {
                    store.delete(genUuid())
                    store.count() shouldBe startingCount
                }
            }
        }

        "#findAll" - {
            store.create(genPhoneNumber(), genEnvelope())
            repeat(3)  { store.create(accountId, genEnvelope()) }

            "returns all envelopes for a given account id" {
                store.findAll(accountId).size shouldBe 3
            }
        }
    }
})
