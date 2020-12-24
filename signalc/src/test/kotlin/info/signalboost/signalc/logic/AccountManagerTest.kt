package info.signalboost.signalc.logic

import info.signalboost.signalc.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.store.AccountStore
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beOfType
import io.mockk.*
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.SignalProtocolStore
import org.whispersystems.libsignal.state.SignedPreKeyRecord
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.push.exceptions.AuthorizationFailedException
import java.util.*
import kotlin.random.Random

class AccountManagerTest : FreeSpec({
    val phoneNumber = genPhoneNumber()

    val mockProtocolStore = mockk<SignalProtocolStore>()
    val mockAccountStore = mockk<AccountStore>()
    val accountManager = AccountManager(mockProtocolStore, mockAccountStore)

    val uuid = UUID.randomUUID()
    val mockSignalAccountManager = mockk<SignalServiceAccountManager> {
        every { requestSmsVerificationCode(any(), any(), any()) } returns Unit
        every { setPreKeys(any(), any(), any()) } returns Unit
    }

    val newAccount = NewAccount(phoneNumber)
    mockkObject(newAccount)
    every { newAccount.manager } returns mockSignalAccountManager

    val registeredAccount = RegisteredAccount.fromNew(newAccount)
    mockkObject(registeredAccount)
    every { registeredAccount.manager } returns mockSignalAccountManager

    val verifiedAccount = VerifiedAccount.fromRegistered(registeredAccount, uuid)
    mockkObject(verifiedAccount)
    every { verifiedAccount.manager } returns mockSignalAccountManager

    afterSpec  {
        // TODO(aguestuser|2020-12-23):
        //  - the expectation of this call is that it will restore all mocked objects
        //    to their unmocked state after this file completes running
        //  - however, this does not happen and as a result SqlProtocolStore tests fail if they run
        //    after this suite b/c the store is still mocked.
        //  - hmm....
        unmockkAll()
    }

    afterTest {
        clearAllMocks(answers = false, childMocks = false, objectMocks = false)
    }

    "#findOrCreate" - {
        every { mockAccountStore.findOrCreate(any()) } answers { newAccount }

        "delegates to AccountStore" {
            accountManager.findOrCreate(phoneNumber)
            verify {
                mockAccountStore.findOrCreate(phoneNumber)
            }
        }
    }

    "#register" - {
        val saveSlot = slot<RegisteredAccount>()
        every { mockAccountStore.save(account = capture(saveSlot)) } answers { firstArg() }

        "requests an sms code from signal" {
            accountManager.register(newAccount)
            verify {
                mockSignalAccountManager.requestSmsVerificationCode(
                    false,
                    absent(),
                    absent()
                )
            }
        }

        "updates the account store" {
            accountManager.register(newAccount)
            verify {
                mockAccountStore.save(any<RegisteredAccount>())
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
        every { mockAccountStore.save(account = capture(saveSlot)) } answers { firstArg() }
        every { mockProtocolStore.localRegistrationId } returns 42

        "when given correct code" - {

            every {
                mockSignalAccountManager.verifyAccountWithCode(
                    code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                )
            } returns mockk {
                every { getUuid() } returns uuid.toString()
            }

            "attempts to verify code" {
                accountManager.verify(registeredAccount, code)
                verify {
                    mockSignalAccountManager.verifyAccountWithCode(
                        code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                    )
                }
            }

            "updates the account store" {
                accountManager.verify(registeredAccount, code)
                verify {
                    mockAccountStore.save(ofType(VerifiedAccount::class))
                }
                saveSlot.captured shouldBe verifiedAccount
            }

            "returns a verified account" {
                accountManager.verify(registeredAccount, code) shouldBe verifiedAccount
            }
        }

        "when given incorrect code" - {
            afterTest {
                clearMocks(mockAccountStore, answers = false)
            }
            every {
                mockSignalAccountManager.verifyAccountWithCode(
                    code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                )
            } throws AuthorizationFailedException("oh noes!")


            "attempts to verify code" {
                accountManager.verify(registeredAccount, code)
                verify {
                    mockSignalAccountManager.verifyAccountWithCode(
                        code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                    )
                }
            }

            "does not update the account store" {
                accountManager.verify(registeredAccount, code)
                verify { mockAccountStore wasNot Called }
            }

            "returns null" {
                accountManager.verify(registeredAccount, code) shouldBe null
            }
        }
    }

    "#publishFirstPrekeys" - {
        val mockPublicKey = mockk<IdentityKey>()
        val mockPreKeys = List(100) {
            mockk<PreKeyRecord> {
                every { id } returns Random.nextInt(0, Integer.MAX_VALUE)
            }
        }
        val mockSignedPreKey = mockk<SignedPreKeyRecord> {
            every { id } returns Random.nextInt(0, Integer.MAX_VALUE)
        }

        mockkObject(KeyUtil)
        every { KeyUtil.genPreKeys(0, 100) } returns mockPreKeys
        every { KeyUtil.genSignedPreKey(any(), any()) } returns mockSignedPreKey

        mockProtocolStore.let {
            every { it.storePreKey(any(), any()) } returns Unit
            every { it.storeSignedPreKey(any(), any()) } returns Unit
            every { it.identityKeyPair } returns mockk {
                every { publicKey } returns mockPublicKey
            }
        }

        "stores 100 prekeys locally" {
            accountManager.publishFirstPrekeys(verifiedAccount)
            verify(exactly = 100) { mockProtocolStore.storePreKey(any(), any())}
        }

        "stores a signed prekey locally" {
            accountManager.publishFirstPrekeys(verifiedAccount)
            verify(exactly = 1) { mockProtocolStore.storeSignedPreKey(any(), any()) }
        }

        "publishes prekeys to signal" {
            accountManager.publishFirstPrekeys(verifiedAccount)
            verify {
                mockSignalAccountManager.setPreKeys(
                    mockPublicKey,
                    mockSignedPreKey,
                    mockPreKeys,
                )
            }
        }
    }
})
