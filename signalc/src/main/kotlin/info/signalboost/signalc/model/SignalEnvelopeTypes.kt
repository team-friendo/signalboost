package info.signalboost.signalc.model

enum class EnvelopeType {
    UNKNOWN,
    CIPHERTEXT,
    KEY_EXCHANGE,
    PREKEY_BUNDLE,
    RECEIPT_VALUE,
    UNIDENTIFIED;

    companion object {
        fun fromInt(int: Int) = when(int) {
            1 -> UNKNOWN
            2 -> CIPHERTEXT
            3 -> KEY_EXCHANGE
            4 -> PREKEY_BUNDLE
            5 -> RECEIPT_VALUE
            else -> UNIDENTIFIED //6
        }
    }

}

