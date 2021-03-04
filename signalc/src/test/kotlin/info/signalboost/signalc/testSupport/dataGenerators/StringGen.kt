package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genLong

object StringGen {
    private const val ALL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz0123456789-"
    private const val HEX_CHARS = "abcdefghiklmnopqrstuvwxyz0123456789"
    private const val DECIMAL_CHARS = "0123456789"

    fun genCaptchaToken(): String = List(504) {
        ALL_CHARS.random()
    }.joinToString("")

    fun genFingerprint() = List(32) {
        "${HEX_CHARS.random()}${HEX_CHARS.random()}"
    }.joinToString(" ")

    fun genPhrase(): String = listOf(
        "a screaming comes across the sky",
        "call me ishmael",
        "dead people never stop talkikng and sometimes the living hear",
    ).random()

    fun genSocketPath(): String = "/signalc/sock/test${genLong()}.sock"

    fun genVerificationCode(): String = listOf(
        List(3) { DECIMAL_CHARS.random() }.joinToString(""),
        List(3) { DECIMAL_CHARS.random() }.joinToString("")
    ).joinToString("-")

    fun genVersionStr(): String = List(3) {
        DECIMAL_CHARS.random()
    }.joinToString(".")
}