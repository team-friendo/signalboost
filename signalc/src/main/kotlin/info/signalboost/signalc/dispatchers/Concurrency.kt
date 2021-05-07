package info.signalboost.signalc.dispatchers

import kotlinx.coroutines.ExecutorCoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicInteger

object Concurrency {
    private val threadFactory = object: ThreadFactory {
        private val threadCount = AtomicInteger(0)
        private val nextThreadName get() = "Dispatcher-worker-${threadCount.incrementAndGet()}"

        override fun newThread(runnable: java.lang.Runnable): Thread {
            return Thread(runnable, nextThreadName)
        }
    }

    val Executor = ThreadPoolExecutor(
        100,
        Int.Companion.MAX_VALUE,
        60L,
        TimeUnit.SECONDS,
        SynchronousQueue<Runnable?>(), // this is what makes the thread pool elastic
        threadFactory
    )

    val Dispatcher = Executor.asCoroutineDispatcher()
}