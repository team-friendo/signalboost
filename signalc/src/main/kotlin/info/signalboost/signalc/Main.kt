package info.signalboost.signalc

import kotlinx.coroutines.*
import kotlin.time.ExperimentalTime

/*************
 * MAIN LOOP
 *************/

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
@Suppress("ControlFlowWithEmptyBody")
fun main() {
    runBlocking {
        Application(Config.fromEnv()).run(this)
        while(true){}
    }
}
