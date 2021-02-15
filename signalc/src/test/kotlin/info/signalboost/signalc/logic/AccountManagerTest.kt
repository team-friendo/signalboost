package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.store.ProtocolStore
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.util.KeyUtil
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.SignedPreKeyRecord
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.push.exceptions.AuthorizationFailedException
import java.util.*
import kotlin.random.Random
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class AccountManagerTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(AccountManager::class)
        val app = Application(config).run(testScope)
        val accountManager = app.accountManager

        val mockProtocolStore: ProtocolStore.AccountProtocolStore = mockk()
        val phoneNumber = genPhoneNumber()
        val uuid = UUID.randomUUID()
        val newAccount = NewAccount(phoneNumber)
        val registeredAccount = RegisteredAccount.fromNew(newAccount)
        val verifiedAccount = VerifiedAccount.fromRegistered(registeredAccount, uuid)

        beforeSpec {
            mockkObject(KeyUtil)
            every { app.protocolStore.of(any()) } returns mockProtocolStore
            mockkConstructor(SignalServiceAccountManager::class)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
            testScope.teardown()
        }

        "#findOrCreate" - {
            coEvery { app.accountStore.findOrCreate(any()) } answers { newAccount }

            "delegates to AccountStore" {
                accountManager.load(phoneNumber)
                coVerify {
                    app.accountStore.findOrCreate(phoneNumber)
                }
            }
        }

        "#register" - {
            val saveSlot = slot<RegisteredAccount>()
            coEvery { app.accountStore.save(account = capture(saveSlot)) } returns Unit
            every {
                anyConstructed<SignalServiceAccountManager>()
                    .requestSmsVerificationCode(any(), any(), any())
            } returns Unit

            "requests an sms code from signal" {
                accountManager.register(newAccount)
                verify {
                    anyConstructed<SignalServiceAccountManager>()
                        .requestSmsVerificationCode(false, absent(), absent())
                }
            }

            "updates the account store" {
                accountManager.register(newAccount)
                coVerify {
                    app.accountStore.save(any<RegisteredAccount>())
                }
                saveSlot.captured shouldBe registeredAccount
            }

            "returns a registered account" {
                accountManager.register(newAccount) shouldBe registeredAccount
            }
        }

        "#verify" - {
            val code = "1312"
            val saveSlot = slot<VerifiedAccount>()
            coEvery { app.accountStore.save(account = capture(saveSlot)) } returns Unit
            every { mockProtocolStore.localRegistrationId } returns 42

            "when given correct code" - {
                every {
                    anyConstructed<SignalServiceAccountManager>().verifyAccountWithCode(
                        code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                    )
                } returns mockk {
                    every { getUuid() } returns uuid.toString()
                }

                "attempts to verify code" {
                    accountManager.verify(registeredAccount, code)
                    verify {
                        anyConstructed<SignalServiceAccountManager>().verifyAccountWithCode(
                            code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                        )
                    }
                }

                "updates the account store" {
                    accountManager.verify(registeredAccount, code)
                    coVerify {
                        app.accountStore.save(ofType(VerifiedAccount::class))
                    }
                    saveSlot.captured shouldBe verifiedAccount
                }

                "returns a verified account" {
                    accountManager.verify(registeredAccount, code) shouldBe verifiedAccount
                }
            }

            "when given incorrect code" - {
                every {
                    anyConstructed<SignalServiceAccountManager>().verifyAccountWithCode(
                        code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                    )
                } throws AuthorizationFailedException("oh noes!")

                "attempts to verify code" {
                    accountManager.verify(registeredAccount, code)
                    verify {
                        anyConstructed<SignalServiceAccountManager>().verifyAccountWithCode(
                            code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                        )
                    }
                }

                "does not update the account store" {
                    accountManager.verify(registeredAccount, code)
                    verify { app.accountStore wasNot Called }
                }

                "returns null" {
                    accountManager.verify(registeredAccount, code) shouldBe null
                }
            }
        }

        "#publishFirstPrekeys" - {
            val mockPublicKey: IdentityKey = mockk()
            val mockPreKeys: List<PreKeyRecord> = List(100) {
                mockk {
                    every { id } returns Random.nextInt(0, Integer.MAX_VALUE)
                }
            }
            val mockSignedPreKey: SignedPreKeyRecord = mockk {
                every { id } returns Random.nextInt(0, Integer.MAX_VALUE)
            }

            mockProtocolStore.let {
                every { it.storePreKey(any(), any()) } returns Unit
                every { it.storeSignedPreKey(any(), any()) } returns Unit
                every { it.identityKeyPair } returns mockk {
                    every { publicKey } returns mockPublicKey
                }
            }

            every { KeyUtil.genPreKeys(0, 100) } returns mockPreKeys
            every { KeyUtil.genSignedPreKey(any(), any()) } returns mockSignedPreKey
            every {
                anyConstructed<SignalServiceAccountManager>().setPreKeys(any(), any(), any())
            } returns Unit

            "stores 100 prekeys locally" {
                accountManager.publishPreKeys(verifiedAccount)
                verify(exactly = 100) { mockProtocolStore.storePreKey(any(), any()) }
            }

            "stores a signed prekey locally" {
                accountManager.publishPreKeys(verifiedAccount)
                verify(exactly = 1) { mockProtocolStore.storeSignedPreKey(any(), any()) }
            }

            "publishes prekeys to signal" {
                accountManager.publishPreKeys(verifiedAccount)
                verify {
                    anyConstructed<SignalServiceAccountManager>().setPreKeys(
                        mockPublicKey,
                        mockSignedPreKey,
                        mockPreKeys,
                    )
                }
            }
        }
    }
})
