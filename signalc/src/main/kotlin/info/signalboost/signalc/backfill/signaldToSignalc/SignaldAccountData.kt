package info.signalboost.signalc.backfill.signaldToSignalc

import info.signalboost.signalc.model.SignalcAddress
import kotlinx.serialization.Required
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

@Serializable
data class SignaldAccountData(
    val username: String,
    val password: String,
    val address: SignalcAddress,
    val signalingKey: String,
    val profileKey: String,
    val axolotlStore: AxolotlStore,
) {
    @Serializable
    data class AxolotlStore(
        val contactStore: ContactStore,
        val identityKeyStore: IdentityStore,
        val preKeys: List<PreKey>,
        val sessionStore: List<SessionRecord>,
        val signedPreKeyStore: List<SignedPreKey>,
        ) {

        @Serializable
        data class ContactStore(
            val contacts: List<Contact>
        ) {
            @Serializable
            data class Contact(
                val address: SignalcAddress,
                @Required
                val profileKey: String? = null, // base-64? hex?
                val messageExpirationTime: Long,
            )
        }

        @Serializable
        data class IdentityStore(
            val trustedKeys: List<IdentityRecord>,
        ) {
            @Serializable
            data class IdentityRecord(
                val address: SignalcAddress,
                val addedTimestamp: Long,
                val identityKey: String, // base-64-encoded (hex-encoded?) byte array
                val trust: TrustLevel,
            ) {
                enum class TrustLevel(asString: String) {
                    TRUSTED_VERIFIED("TRUSTED_VERIFIED"),
                    TRUSTED_UNVERIFIED("TRUSTED_UNVERIFIED"),
                    UNTRUSTED("UNTRUSTED");
                }
            }
        }

        @Serializable
        data class PreKey(
            val id: Int,
            val record: String, // base-64 encoded byte arrray
        )

        @Serializable
        data class SessionRecord(
            val address: SignalcAddress,
            val deviceId: Int,
            val record: String, // base-64-encoded byte arrray
        )

        @Serializable
        data class SignedPreKey(
            val id: Int,
            val record: String, // base-64-encoded byte array
        )
    }

    companion object {
        fun fromJson(jsonString: String): SignaldAccountData =
            Json.decodeFromString(jsonString)

    }
}