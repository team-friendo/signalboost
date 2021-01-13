package info.signalboost.signalc

import info.signalboost.signalc.Config.USER_PHONE_NUMBER
import info.signalboost.signalc.logic.AccountManager
import info.signalboost.signalc.logic.MessageSender
import info.signalboost.signalc.logic.MessageSender.Companion.asAddress
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.NewAccount
import info.signalboost.signalc.model.RegisteredAccount
import info.signalboost.signalc.model.VerifiedAccount


/*************
 * MAIN LOOP
 *************/

fun main() {
    val app = Application(Config.dev)
    val accountManager = AccountManager(app)
    val messageSender = MessageSender(app)

    // find or create account
    val verifiedAccount: VerifiedAccount = when(
        val account: Account = accountManager.load(USER_PHONE_NUMBER)
    ) {
        is NewAccount -> register(accountManager, account)
        is RegisteredAccount -> register(accountManager, NewAccount.fromRegistered(account))
        is VerifiedAccount -> account
        else -> null
    } ?: return println("Couldn't find or create account with number $USER_PHONE_NUMBER")

    // send some messages!

    while(true){
        println("\nWhat number would you like to send a message to?")
        val recipientPhone = readLine() ?: return

        println("What message would you like to send?")
        val message = readLine() ?: return
        messageSender.send(
            sender = verifiedAccount,
            recipient = recipientPhone.asAddress(),
            body = message
        )
        println("Sent \"$message\" to $recipientPhone\n")
    }
}

fun register(accountManager: AccountManager, newAccount: NewAccount): VerifiedAccount? {

    println("Asking Signal to text a verification code to $USER_PHONE_NUMBER...")
    val registeredAccount = accountManager.register(newAccount)

    println("Please enter the code:")
    val verificationCode = readLine() ?: return null
    val verifiedAccount = accountManager.verify(registeredAccount, verificationCode)
        ?.let {
            accountManager.publishPreKeys(it)
        }
        ?: run {
            println("Verification failed! Wrong code?")
            null
        }

    println("$USER_PHONE_NUMBER registered and verified!")
    return verifiedAccount
}