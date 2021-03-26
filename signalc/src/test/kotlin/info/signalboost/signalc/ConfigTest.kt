package info.signalboost.signalc

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.InternalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class ConfigTest : FreeSpec({

    "provides default configs for every env" {
        Config.fromEnv("production") shouldBe Config.prod
        Config.fromEnv("development") shouldBe Config.dev
        Config.fromEnv("test") shouldBe Config.mockStore
    }

    "throws if asked to provide configs for a garbage env" {
        shouldThrow<Error> { Config.fromEnv("foo") }
    }

    "throws if asked to provide configs for a miss env" {
        shouldThrow<Error> { Config.fromEnv(null) }
    }
})
