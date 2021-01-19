package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import java.util.*

object Account {
    fun genNewAccount(phoneNumber: String = genPhoneNumber()) =
        NewAccount(phoneNumber)

    fun genRegisteredAccount(newAccount: NewAccount = genNewAccount()) =
        RegisteredAccount.fromNew(newAccount)

    fun genVerifiedAccount(
        registeredAccount: RegisteredAccount = genRegisteredAccount(),
        uuid: UUID = UUID.randomUUID()
    ) =
        VerifiedAccount.fromRegistered(registeredAccount, uuid)
}