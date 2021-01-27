package info.signalboost.signalc

import info.signalboost.signalc.Config.USER_PHONE_NUMBER
import info.signalboost.signalc.logic.AccountManager
import info.signalboost.signalc.logic.SignalMessageSender
import info.signalboost.signalc.logic.SignalMessageSender.Companion.asAddress
import info.signalboost.signalc.logic.SignalMessageDispatcher
import info.signalboost.signalc.model.*
import kotlinx.coroutines.*


/*************
 * MAIN LOOP
 *************/

@ExperimentalCoroutinesApi
fun main() = runBlocking {
    val app = Application(Config.fromEnv(), this)
    val accountManager = AccountManager(app)
    val messageSender = SignalMessageSender(app)
    val dispatcher = SignalMessageDispatcher(app)

    // find or create account
    val verifiedAccount: VerifiedAccount = when(
        val account: Account = accountManager.load(USER_PHONE_NUMBER)
    ) {
        is NewAccount -> register(accountManager, account)
        is RegisteredAccount -> register(accountManager, NewAccount.fromRegistered(account))
        is VerifiedAccount -> account
        else -> null
    } ?: return@runBlocking println("Couldn't find or create account with number $USER_PHONE_NUMBER")


    // subscribe to messages on this number...
    val listenForIncoming: Job = launch {
        println("Subscribing to messages for ${verifiedAccount.username}...")
        val incomingMessages = dispatcher.subscribe(verifiedAccount)
        println("...subscribed to messages for ${verifiedAccount.username}.")

        while(!incomingMessages.isClosedForReceive) {
            when(val msg = incomingMessages.receive()) {
                is Cleartext -> println("\nMessage from [${msg.sender.number.orNull()}]:\n${msg.body}\n")
            }
        }
    }

    // send messages...
    val listenForOutgoing: Job = launch {
        while (true) {
            withContext(Dispatchers.IO) {
                println("\nWhat number would you like to send a message to?")
                val recipientPhone = readLine() ?: return@withContext

                println("What message would you like to send?")
                val message = readLine() ?: return@withContext
                messageSender.send(
                    sender = verifiedAccount,
                    recipient = recipientPhone.asAddress(),
                    body = message
                )
                println("Sent \"$message\" to $recipientPhone\n")
            }
        }
    }

    listOf(listenForIncoming, listenForOutgoing).joinAll()
}

@ExperimentalCoroutinesApi
suspend fun register(accountManager: AccountManager, newAccount: NewAccount): VerifiedAccount? {

    println("Asking Signal to text a verification code to $USER_PHONE_NUMBER...")
    val registeredAccount = accountManager.register(newAccount)

    println("Please enter the code:")
    val verificationCode = readLine() ?: return null
    val verifiedAccount = accountManager.verify(registeredAccount, verificationCode)
        ?.let {
            accountManager.publishPreKeys(it)
        }
        ?: run {
            println("Verification failed! Wrong code?\n")
            null
        }

    println("$USER_PHONE_NUMBER registered and verified!\n")
    return verifiedAccount
}