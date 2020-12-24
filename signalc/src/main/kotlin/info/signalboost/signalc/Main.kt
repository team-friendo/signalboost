package info.signalboost.signalc

import info.signalboost.signalc.logic.AccountManager
import info.signalboost.signalc.logic.Messaging
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.HashMapProtocolStore
import info.signalboost.signalc.store.SqlProtocolStore
import org.jetbrains.exposed.sql.Database


/********************************************************************
 * DEV-CONFIGURABLE VALUES (CHANGE TO RUN SPIKE CODE ON YOUR LAPTOP)
 *******************************************************************/
const val USER_PHONE_NUMBER = "+17347962920"

/*************
 * MAIN LOOP
 *************/

fun main() {
    // TODO: push db and protocol store injection into config layer!
    // connect to db
    val db = Database.connect(
        url = "jdbc:pgsql://localhost:5432/signalc_test",
        driver = "com.impossibl.postgres.jdbc.PGDriver",
        user = "postgres"
    )

    // create account
    val accountManager = AccountManager(
        SqlProtocolStore(db, USER_PHONE_NUMBER),
        AccountStore(db)
    )
    val newAccount = accountManager.create(USER_PHONE_NUMBER)

    // register account
    println("Asking signal for an sms verification code...")
    val registeredAccount = accountManager.register(newAccount)

    // verify account
    println("Please enter the code:")
    val verificationCode = readLine() ?: return
    val verifiedAccount = accountManager.verify(registeredAccount, verificationCode)
        ?.let { accountManager.publishFirstPrekeys(it) }
        ?: return println("Verification failed! Wrong code?")

    println("$USER_PHONE_NUMBER registered and verified!")

    // send some messages!
    val messageSender = accountManager.messageSenderOf(verifiedAccount)
    while(true){
        println("\nWhat number would you like to send a message to?")
        val recipientPhone = readLine() ?: return

        println("What message would you like to send?")
        val messageBody = readLine() ?: return

        Messaging.sendMessage(messageSender, messageBody, recipientPhone)
        println("Sent \"$messageBody\" to $recipientPhone\n")
    }
}