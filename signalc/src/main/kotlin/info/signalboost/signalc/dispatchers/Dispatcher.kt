package info.signalboost.signalc.dispatchers

import kotlinx.coroutines.ExecutorCoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicInteger

object Dispatcher {
    private fun dispatcherOf(klass: String): ExecutorCoroutineDispatcher {
        val threadFactory = object: ThreadFactory {
            private val threadCount = AtomicInteger(0)
            private val nextThreadName get() = "$klass-worker-${threadCount.incrementAndGet()}"

            override fun newThread(runnable: java.lang.Runnable): Thread {
                return Thread(runnable, nextThreadName)
            }
        }

        return Executors.newCachedThreadPool(threadFactory).asCoroutineDispatcher()
    }

    val Main = dispatcherOf("Main")
}