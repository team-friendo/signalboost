package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.util.SocketHashCode
import kotlin.random.Random

object NumGen {
    fun genInt(): Int = Random.nextInt(0, Int.MAX_VALUE)
    fun genLong(): Long = Random.nextLong(0L, Long.MAX_VALUE)
    fun genSocketHash(): SocketHashCode = Any().hashCode()
}