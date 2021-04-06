package info.signalboost.signalc

import kotlinx.coroutines.*
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

/*************
 * MAIN LOOP
 *************/

@ExperimentalPathApi
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
