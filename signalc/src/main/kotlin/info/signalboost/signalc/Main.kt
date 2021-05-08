package info.signalboost.signalc

import kotlinx.coroutines.*
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime
import io.prometheus.client.exporter.HTTPServer;
import io.prometheus.client.hotspot.DefaultExports;

/*************
 * MAIN LOOP
 *************/

@ExperimentalPathApi
@Suppress("ControlFlowWithEmptyBody")
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
fun main() {
    HTTPServer(1312)
    DefaultExports.initialize()

    runBlocking {
        Application(Config.fromEnv()).run(this)
    }
    while(true) { }
}
