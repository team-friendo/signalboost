package info.signalboost.signalc

import kotlinx.coroutines.*


/*************
 * MAIN LOOP
 *************/

@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
fun main() {
    runBlocking {
        Application(Config.fromEnv()).run(this)
    }
}

