package info.signalboost.signalc

import kotlinx.coroutines.*
import kotlin.time.ExperimentalTime

/*************
 * MAIN LOOP
 *************/

@Suppress("ControlFlowWithEmptyBody")
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi

fun main() {
    runBlocking {
        Application(Config.fromEnv()).run(this)
    }
    while(true) { }
}
