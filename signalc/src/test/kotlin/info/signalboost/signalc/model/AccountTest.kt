package info.signalboost.signalc.model

import info.signalboost.signalc.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.logic.KeyUtil
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

class AccountTest : FreeSpec({
    val phoneNumber = genPhoneNumber()
    val mockProtocolStore = mockk<SignalProtocolStore>()

    val unregisteredAccount = UnregisteredAccount(phoneNumber, mockProtocolStore)
    val mockAccountManager = mockk<SignalServiceAccountManager> {
        every { requestSmsVerificationCode(any(), any(), any()) } returns Unit
    }

    mockkObject(unregisteredAccount)
    every { unregisteredAccount.asAccountManager } returns mockAccountManager

    "#register" - {
        "requests an sms code from signal" - {
            unregisteredAccount.register()
            verify {
                mockAccountManager.requestSmsVerificationCode(
                    false,
                    absent(),
                    absent()
                )
            }
        }
    }

    "#verify" - {
        val code = "1312"
        val uuid = UUID.randomUUID().toString()
        every { mockProtocolStore.localRegistrationId } returns 42

        "when given correct code" - {
            every {
                mockAccountManager.verifyAccountWithCode(
                    code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                )
            } returns mockk {
                every { getUuid() } returns uuid
            }

            "attempts to verify code" - {
                unregisteredAccount.verify(code)
                verify {
                    mockAccountManager.verifyAccountWithCode(
                        code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                    )
                }
            }

            "returns a registered account" - {
                unregisteredAccount.verify(code) should beOfType<RegisteredAccount>()
            }
        }

        "when given incorrect code" - {
            every {
                mockAccountManager.verifyAccountWithCode(
                    code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                )
            } throws AuthorizationFailedException("oh noes!")

            "attempts to verify code" - {
                unregisteredAccount.verify(code)
                verify {
                    mockAccountManager.verifyAccountWithCode(
                        code, any(), any(), any(), any(), any(), any(), any(), any(), any()
                    )
                }
            }

            "returns null" - {
                unregisteredAccount.verify(code) shouldBe null
            }
        }
    }

    "#publishFirstPrekeys" - {
        val uuid = UUID.randomUUID()
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

        every { mockAccountManager.setPreKeys(any(), any(), any()) } returns Unit

        val registeredAccount = RegisteredAccount.fromUnregisteredAccount(unregisteredAccount, uuid)
        mockkObject(registeredAccount)
        every { registeredAccount.asAccountManager } returns mockAccountManager
        registeredAccount.publishFirstPrekeys()

        "stores 100 prekeys locally" -{
            verify(exactly = 100) { mockProtocolStore.storePreKey(any(), any())}
        }

        "stores a signed prekey locally" -{
            verify(exactly = 1) { mockProtocolStore.storeSignedPreKey(any(), any()) }
        }

        "publishes prekeys to signal" - {
            verify {
                mockAccountManager.setPreKeys(
                    mockPublicKey,
                    mockSignedPreKey,
                    mockPreKeys,
                )
            }
        }
    }
})
