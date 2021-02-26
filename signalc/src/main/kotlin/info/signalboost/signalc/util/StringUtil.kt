package info.signalboost.signalc.util

object StringUtil {
    fun String.asSanitizedCode(): String = this.replace("-", "")
}