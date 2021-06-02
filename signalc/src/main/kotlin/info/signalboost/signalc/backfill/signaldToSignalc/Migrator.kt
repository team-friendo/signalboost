package info.signalboost.signalc.backfill.signaldToSignalc

import info.signalboost.signalc.Application
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalPathApi
@ExperimentalTime
class Migrator(val app: Application) {
    // TODO: if we want to decouple from app, we need to modify stores to take db as arg, not app

    suspend fun migrateAll(path: String): Int = File(path).walk().map {
        // TODO: make this non-blocking?
        runBlocking {
            migrateOne(it)
        }
    }.sum()

    private suspend fun migrateOne(file: File): Int =
        SignaldAccountData.fromJson(file.readText(Charsets.UTF_8)).let {
            SignalcAccountData.from(it).writeToStores(
                app.accountStore,
                app.profileStore,
                app.protocolStore,
            )
        }
    // TODO:
    // - (1) create a backfills table
    // - (2) maybe (?) filter out non-members (eitehr inline or as postprocessing step (if we don't want to worry about trying to bacdkfill profile keys for people who have unsubscribe
    // - (3) maybe (?)backfill profile keys across contacts
}