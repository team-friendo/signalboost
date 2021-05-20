package info.signalboost.signalc.serialization

object ByteArrayEncoding {
    fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
    fun ByteArray.toPostgresHex(): String = "decode('${toHex()}', 'hex')"
}