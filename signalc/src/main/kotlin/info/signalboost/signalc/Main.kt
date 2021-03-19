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
    println("Available Processors: ${Runtime.getRuntime().availableProcessors()}")
    println("IO: ${Runtime.getRuntime().availableProcessors() * 128}")
    System.setProperty(IO_PARALLELISM_PROPERTY_NAME, (Runtime.getRuntime().availableProcessors() * 128).toString())
    runBlocking {
        Application(Config.fromEnv()).run(this)
    }
    while(true) { }
}
