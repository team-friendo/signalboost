package info.signalboost.signalc

import info.signalboost.signalc.logic.Messaging
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.UnregisteredAccount
import info.signalboost.signalc.store.SignalcProtocolStore
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Security

/********************************************************************
 * DEV-CONFIGURABLE VALUES (CHANGE TO RUN SPIKE CODE ON YOUR LAPTOP)
 *******************************************************************/
const val USER_PHONE_NUMBER = "+17347962920"
const val KEYSTORE_PATH = "/home/aguestuser/-/team-friendo/code/signalc/whisper.store" // read from `pwd`?

/*************
 * MAIN LOOP
 *************/

fun main() {
    // Workaround for BKS truststore (copied from signald -- keep?)
    Security.addProvider(BouncyCastleProvider())

    // intialize account
    val unregisteredAccount = UnregisteredAccount(username = USER_PHONE_NUMBER, protocolStore = SignalcProtocolStore)

    // register account
    println("Asking signal for an sms verification code...")
    unregisteredAccount.register()
    println("Please enter the code:")
    val verificationCode = readLine() ?: return

    // verify account
    val registeredAccount = unregisteredAccount.verify(verificationCode) ?:
        return println("Verification failed! Wrong code?")
    registeredAccount.publishFirstPrekeys()
    println("$USER_PHONE_NUMBER registered and verified!")

    // send some messages!
    val messageSender = Messaging.messageSenderOf(registeredAccount, SignalcProtocolStore)
    while(true){
        println("\nWhat number would you like to send a message to?")
        val recipientPhone = readLine() ?: return

        println("What message would you like to send?")
        val messageBody = readLine() ?: return

        Messaging.sendMessage(messageSender, messageBody, recipientPhone)
        println("Sent \"$messageBody\" to $recipientPhone\n")
    }
}