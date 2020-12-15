package info.signalboost.signalc.fixtures

import kotlin.random.Random


object PhoneNumber {
    fun genPhoneNumber(): String =
        "+1" + List(10) { Random.nextInt(0, 9) }.joinToString()
}