package info.signalboost.signalc

import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class ApplicationTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAll
        val app = Application(config).run(testScope)
        
        "#run" - {
            "initializes application resources" {}
            "initializes all 'cold' application components" {}
            "initializes and runs all 'hot' application components" {}
        }

        "#stop" - {
            "cleans up all app resources" {}
            "closes down all 'hot' app components" {}
            "returns a reference to the application for restarting" {}
        }
    }
})
