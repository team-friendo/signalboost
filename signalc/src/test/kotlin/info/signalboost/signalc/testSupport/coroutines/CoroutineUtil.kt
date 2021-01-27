package info.signalboost.signalc.testSupport.coroutines

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.TestCoroutineDispatcher
import kotlinx.coroutines.test.TestCoroutineScope

@ExperimentalCoroutinesApi
object CoroutineUtil {
    fun genTestScope(): TestCoroutineScope = TestCoroutineScope(TestCoroutineDispatcher() + Job())

    fun TestCoroutineScope.teardown() {
        this.cancel()
        this.cleanupTestCoroutines()
    }
}