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
//@InternalCoroutinesApi
fun main() {
    runBlocking {
        Application(Config.fromEnv()).run(this)
    }
    while(true) { }
}
