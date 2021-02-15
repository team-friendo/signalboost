package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import java.util.*

object AccountGen {
    fun genNewAccount(phoneNumber: String = genPhoneNumber()) =
        NewAccount(phoneNumber)

    fun genRegisteredAccount(
        phoneNumber: String = genPhoneNumber(),
        newAccount: NewAccount = genNewAccount(phoneNumber),
    ) =
        RegisteredAccount.fromNew(newAccount)

    fun genVerifiedAccount(
        phoneNumber: String = genPhoneNumber(),
        registeredAccount: RegisteredAccount = genRegisteredAccount(phoneNumber),
        uuid: UUID = UUID.randomUUID()
    ) =
        VerifiedAccount.fromRegistered(registeredAccount, uuid)
}