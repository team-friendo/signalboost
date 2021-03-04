package info.signalboost.signalc

import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlin.time.ExperimentalTime


/*************
 * MAIN LOOP
 *************/

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
fun main() {
    runBlocking(IO) {
        Application(Config.fromEnv()).run(this)
        while(true){}
    }
}
