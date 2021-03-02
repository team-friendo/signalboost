package info.signalboost.signalc.logging

import info.signalboost.signalc.Application
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import mu.KLoggable
import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import mu.KLogger
import kotlin.reflect.KClass
import kotlin.reflect.jvm.jvmName
import kotlin.time.ExperimentalTime

@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalTime
interface Loggable: KLoggable {
    companion object Levels {
        var KLogger.level: Level
            get() =
                (underlyingLogger as Logger).level
            set(value) {
                (underlyingLogger as Logger).level = value
            }
    }

    class Of(val app: Application, klass: KClass<out Any>): Loggable {
        override val logger: KLogger = logger(klass.jvmName)
        init {
            logger.level = app.config.logging.level
        }
    }
}