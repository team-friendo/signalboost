package info.signalboost.signalc.backfill.signaldToSignalc

import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.serialization.ByteArrayEncoding.decodeHex
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.ProfileStore
import info.signalboost.signalc.store.ProtocolStore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.SessionRecord
import org.whispersystems.libsignal.state.SignedPreKeyRecord
import org.whispersystems.signalservice.api.push.SignalServiceAddress.DEFAULT_DEVICE_ID
import java.util.*
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
@ExperimentalTime
@ExperimentalPathApi
data class SignalcAccountData(
    val account: VerifiedAccount,
    val contacts: List<Contact>,
    val identities: List<Identity>,
    val preKeys: List<PreKey>,
    val sessions: List<Session>,
    val signedPreKeys: List<SignedPreKey>,
) {
   data class Contact(
       val accountId: String,
       val contactPhoneNumber: String?,
       val contactUuid: UUID?,
       val profileKey: ByteArray?,
   )

   data class Identity(
       val address: SignalProtocolAddress,
       val identityKey: IdentityKey,
       val isTrusted: Boolean,
   )

    data class PreKey(
        val id: Int,
        val record: PreKeyRecord,
    )

    data class Session(
        val address: SignalProtocolAddress,
        val record: SessionRecord,
    )

    data class SignedPreKey(
        val id: Int,
        val record: SignedPreKeyRecord,
    )

    suspend fun writeToStores(
        accountStore: AccountStore,
        contactStore: ProfileStore,
        protocolStore: ProtocolStore,
    ): Int {
        accountStore.import(account)

        contacts.forEach {
            // TODO:
            //  - need to create int ids for each contact to write them
            //  - and store profile key if it exists...
//            it.profileKey?.let { pkBytes ->
//                contactStore.storeProfileKey(it.accountId, it.contactId, pkBytes) }
        }

        val accProtocolStore = protocolStore.of(account)
        identities.forEach {
            accProtocolStore.saveIdentity(it.address, it.identityKey)
            // TODO: double check we got the deserialization right here!
            // if(it.isTrusted) accProtocolStore.trustFingerprint(...)
            // else accProtocolStore.untrustFingerprint(it.identityKey.fingerprint.decodeHex())
        }
        preKeys.forEach {
            accProtocolStore.storePreKey(it.id, it.record)
        }
        sessions.forEach {
            accProtocolStore.storeSession(it.address, it.record)
        }
        signedPreKeys.forEach {
            accProtocolStore.storeSignedPreKey(it.id, it.record)
        }
        return sessions.size
    }

    companion object {

        fun from(sd: SignaldAccountData): SignalcAccountData =
            SignalcAccountData(
                account = VerifiedAccount(
                    uuid = sd.address.uuid!!,
                    username = sd.username,
                    password = sd.password,
                    signalingKey = sd.signalingKey,
                    profileKeyBytes = sd.profileKey.decodeHex(),
                    deviceId = DEFAULT_DEVICE_ID,
                ),
                contacts = sd.axolotlStore.contactStore.contacts.map {
                    Contact(
                        accountId = sd.username,
                        contactPhoneNumber = it.address.number!!,
                        contactUuid = it.address.uuid,
                        profileKey = it.profileKey?.decodeHex(), // TODO: base-64?
                    )
                },
                identities = sd.axolotlStore.identityKeyStore.trustedKeys.map {
                        Identity(
                            address = SignalProtocolAddress(it.address.number, DEFAULT_DEVICE_ID),
                            identityKey = IdentityKey(it.identityKey.decodeHex()), // TODO: base-64?
                            isTrusted = it.trust != SignaldAccountData.AxolotlStore.IdentityStore.IdentityRecord.TrustLevel.UNTRUSTED,
                        )
                    },
                preKeys = sd.axolotlStore.preKeys.map {
                    PreKey(
                        id = it.id,
                        record = PreKeyRecord(it.record.decodeHex()) // TODO: base-64?
                    )
                },
                sessions = sd.axolotlStore.sessionStore.map {
                    Session(
                        address = SignalProtocolAddress(it.address.number, it.deviceId),
                        record = SessionRecord(it.record.decodeHex()) // TODO: base-64?
                    )
                },
                signedPreKeys = sd.axolotlStore.signedPreKeyStore.map {
                    SignedPreKey(
                        id = it.id,
                        record = SignedPreKeyRecord(it.record.decodeHex()), //TODO: base-64?
                    )
                }
            )
    }
}