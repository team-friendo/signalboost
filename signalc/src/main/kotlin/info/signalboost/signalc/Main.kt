package info.signalboost.signalc

import info.signalboost.signalc.Config.USER_PHONE_NUMBER
import info.signalboost.signalc.logic.Registrar
import info.signalboost.signalc.logic.Messenger
import info.signalboost.signalc.logic.Messenger.Companion.asAddress
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount


/*************
 * MAIN LOOP
 *************/

fun main() {
    val app = Application(Config.dev)
    val registrar = Registrar(app)
    val messenger = Messenger(app)

    // find or create account
    val verifiedAccount: VerifiedAccount = when(
        val account: Account = registrar.load(USER_PHONE_NUMBER)
    ) {
        is NewAccount -> register(registrar, account)
        is RegisteredAccount -> register(registrar, NewAccount.fromRegistered(account))
        is VerifiedAccount -> account
        else -> null
    } ?: return println("Couldn't find or create account with number $USER_PHONE_NUMBER")

    // send some messages!

    while(true){
        println("\nWhat number would you like to send a message to?")
        val recipientPhone = readLine() ?: return

        println("What message would you like to send?")
        val message = readLine() ?: return
        messenger.send(
            sender = verifiedAccount,
            recipient = recipientPhone.asAddress(),
            body = message
        )
        println("Sent \"$message\" to $recipientPhone\n")
    }
}

fun register(registrar: Registrar, newAccount: NewAccount): VerifiedAccount? {

    println("Asking Signal to text a verification code to $USER_PHONE_NUMBER...")
    val registeredAccount = registrar.register(newAccount)

    println("Please enter the code:")
    val verificationCode = readLine() ?: return null
    val verifiedAccount = registrar.verify(registeredAccount, verificationCode)
        ?.let {
            registrar.publishPreKeys(it)
        }
        ?: run {
            println("Verification failed! Wrong code?")
            null
        }

    println("$USER_PHONE_NUMBER registered and verified!")
    return verifiedAccount
}