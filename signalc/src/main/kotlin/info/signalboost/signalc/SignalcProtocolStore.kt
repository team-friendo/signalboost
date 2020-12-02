package info.signalboost.signalc

import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.*
import org.whispersystems.libsignal.util.KeyHelper

object SignalcProtocolStore: SignalProtocolStore {

    // TODO(aguestuser|2020-12-01): delegate to 3 substores for Identity, Prekeys, and Session?

    /********* PREKEYS *********/

    val preKeys: MutableList<PreKeyRecord> = mutableListOf()
    val signedPreKeys: MutableList<SignedPreKeyRecord> = mutableListOf()

    // PREKEY
    override fun containsPreKey(preKeyId: Int): Boolean = preKeys.any { it.id == preKeyId }
    override fun loadPreKey(preKeyId: Int): PreKeyRecord = preKeys.find { it.id == preKeyId } ?: throw InvalidKeyException("loadPreKey($preKeyId)")
    override fun removePreKey(preKeyId: Int) { preKeys.removeIf { it.id == preKeyId } }
    override fun storePreKey(preKeyId: Int, record: PreKeyRecord) { preKeys.add(record) }

    // SIGNED PREKEY
    override fun containsSignedPreKey(signedPreKeyId: Int) = signedPreKeys.any { it.id == signedPreKeyId }
    override fun loadSignedPreKey(signedPreKeyId: Int): SignedPreKeyRecord = signedPreKeys.find { it.id == signedPreKeyId } ?: throw InvalidKeyException("loadSignedPreKey($signedPreKeyId)")
    override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> = signedPreKeys.toMutableList()
    override fun removeSignedPreKey(signedPreKeyId: Int) { signedPreKeys.removeIf { it.id == signedPreKeyId } }
    override fun storeSignedPreKey(signedPreKeyId: Int, record: SignedPreKeyRecord) { signedPreKeys.add(record) }

    /********* IDENTITY *********/

    val ourIdentityKeyPair = KeyHelper.generateIdentityKeyPair()
    val ourLocalRegistrationId = KeyHelper.generateRegistrationId(false)
    val identities: MutableMap<SignalProtocolAddress, IdentityKey> = mutableMapOf()

    override fun getIdentityKeyPair(): IdentityKeyPair = ourIdentityKeyPair
    override fun getIdentity(address: SignalProtocolAddress) = identities.getValue(address)
    override fun getLocalRegistrationId(): Int = ourLocalRegistrationId

    override fun isTrustedIdentity(
        address: SignalProtocolAddress,
        identityKey: IdentityKey,
        direction: IdentityKeyStore.Direction
    ): Boolean = when (val trustedKey = identities[address]) {
        null -> true // TOFU
        else -> identityKey == trustedKey // never trust a new key (we could modify this)
    }

    override fun saveIdentity(address: SignalProtocolAddress, identityKey: IdentityKey): Boolean {
        val replacesPreviousIdentity = identities.contains(address)
        identities[address] = identityKey
        return replacesPreviousIdentity
    }

    /********* SESSIONS *********/

    var sessions: MutableMap<SignalProtocolAddress, SessionRecord> = mutableMapOf()

    override fun containsSession(address: SignalProtocolAddress): Boolean = sessions.contains(address)
    override fun deleteSession(address: SignalProtocolAddress) { sessions.remove(address) }
    override fun deleteAllSessions(name: String?) = with(sessions.iterator()) { forEach { if (it.key.name == name) remove() } }
    override fun getSubDeviceSessions(name: String) = sessions.keys.filter { it.name == name }.map { it.deviceId }.toMutableList()

    override fun loadSession(address: SignalProtocolAddress): SessionRecord {
        val existing = sessions[address]
        if (existing != null) {
            // Is there an easier way to make a copy?
            return SessionRecord(existing.serialize())
        }
        val fresh = SessionRecord()
        sessions[address] = fresh
        return fresh
    }

    override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) = sessions.set(address, record)
}
