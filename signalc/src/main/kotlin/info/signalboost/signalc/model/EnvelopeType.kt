package info.signalboost.signalc.model

enum class EnvelopeType {
    UNKNOWN,
    CIPHERTEXT,
    KEY_EXCHANGE,
    PREKEY_BUNDLE,
    RECEIPT,
    UNIDENTIFIED_SENDER;

    companion object {
        fun fromInt(int: Int): EnvelopeType = when(int) {
            0 -> UNKNOWN
            1 -> CIPHERTEXT
            2 -> KEY_EXCHANGE
            3 -> PREKEY_BUNDLE
            5 -> RECEIPT
            6 -> UNIDENTIFIED_SENDER
            else -> UNKNOWN
        }

        fun Int.asEnum(): EnvelopeType = fromInt(this)
    }
}

