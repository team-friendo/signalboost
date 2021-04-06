package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genLong
import info.signalboost.signalc.util.KeyUtil
import org.postgresql.util.Base64

object StringGen {
    private const val ALL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz0123456789-"
    private const val HEX_CHARS = "abcdefghiklmnopqrstuvwxyz0123456789"
    private const val DECIMAL_CHARS = "0123456789"
    private val SHORT_WORDS = listOf("foo", "bar", "baz", "bam", "wowie", "zowie")

    fun genBase64EncodedBytes(): String = Base64.encodeBytes(KeyUtil.genRandomBytes(32))

    fun genCaptchaToken(): String = List(504) {
        ALL_CHARS.random()
    }.joinToString("")

    fun genFileName(): String {
        val fileExtensions = listOf(".png", ".pdf", ".odt")
        return "/signalc/" +
                List(2) { SHORT_WORDS.random() }.joinToString("/") +
                fileExtensions.random()
    }

    fun genFingerprint() = List(32) {
        "${HEX_CHARS.random()}${HEX_CHARS.random()}"
    }.joinToString(" ")

    fun genPhrase(): String = listOf(
        "a screaming comes across the sky",
        "call me ishmael",
        "dead people never stop talking and sometimes the living hear",
        "i woke up like this",
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