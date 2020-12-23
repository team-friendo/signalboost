package info.signalboost.signalc

import info.signalboost.signalc.logic.AccountSupervisor
import info.signalboost.signalc.logic.Messaging
import info.signalboost.signalc.logic.UnregisteredAccount
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.UnregisteredAccount
import info.signalboost.signalc.store.HashMapProtocolStore


/********************************************************************
 * DEV-CONFIGURABLE VALUES (CHANGE TO RUN SPIKE CODE ON YOUR LAPTOP)
 *******************************************************************/
const val USER_PHONE_NUMBER = "+17347962920"

/*************
 * MAIN LOOP
 *************/

fun main() {
    // intialize account
    val accountSupervisor = AccountSupervisor(HashMapProtocolStore)
    val unregisteredAccount = UnregisteredAccount(username = USER_PHONE_NUMBER, protocolStore = HashMapProtocolStore)


    // register account
    println("Asking signal for an sms verification code...")
    accountSupervisor.register(unregisteredAccount)
    println("Please enter the code:")
    val verificationCode = readLine() ?: return

    // verify account
    val registeredAccount = accountSupervisor.verify(unregisteredAccount, verificationCode) ?:
        return println("Verification failed! Wrong code?")
    accountSupervisor.publishFirstPrekeys(registeredAccount)
    println("$USER_PHONE_NUMBER registered and verified!")

    // send some messages!
    val messageSender = accountSupervisor.messageSenderOf(registeredAccount)
    while(true){
        println("\nWhat number would you like to send a message to?")
        val recipientPhone = readLine() ?: return

        println("What message would you like to send?")
        val messageBody = readLine() ?: return

        Messaging.sendMessage(messageSender, messageBody, recipientPhone)
        println("Sent \"$messageBody\" to $recipientPhone\n")
    }
}