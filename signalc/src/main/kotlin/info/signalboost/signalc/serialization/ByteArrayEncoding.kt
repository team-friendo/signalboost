package info.signalboost.signalc.serialization

object ByteArrayEncoding {
    fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
    fun ByteArray.toPostgresHex(): String = "decode('${toHex()}', 'hex')"

    // TODO: decode/encode base64

    fun String.decodeHex(): ByteArray {
        require(length % 2 == 0) { "Must have an even length" }

        return chunked(2)
            .map { it.toInt(16).toByte() }
            .toByteArray()
    }
}