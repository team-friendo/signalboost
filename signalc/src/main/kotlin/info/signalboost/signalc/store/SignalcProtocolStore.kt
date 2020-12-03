package info.signalboost.signalc.store

import info.signalboost.signalc.logic.KeyUtil
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.*

object SignalcProtocolStore: SignalProtocolStore {

    // TODO(aguestuser|2020-12-01): delegate to 3 substores for Identity, Prekeys, and Session?

    /********* PREKEYS *********/

    val preKeys: MutableMap<Int, PreKeyRecord> = mutableMapOf()

    override fun containsPreKey(id: Int): Boolean = preKeys.containsKey(id)
    override fun loadPreKey(id: Int): PreKeyRecord = preKeys[id] ?: throw InvalidKeyException("loadPreKey($id)")
    override fun removePreKey(id: Int) { preKeys.remove(id) }
    override fun storePreKey(id: Int, prekey: PreKeyRecord) { preKeys[id] = prekey }


    /********* SIGNED PREKEYS *********/

    val signedPreKeys: MutableMap<Int, SignedPreKeyRecord> = mutableMapOf()

    override fun containsSignedPreKey(id: Int) = signedPreKeys.containsKey(id)
    override fun loadSignedPreKey(id: Int): SignedPreKeyRecord = signedPreKeys[id] ?: throw InvalidKeyException("loadSignedPreKey($id)")
    override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> = signedPreKeys.values.toMutableList()
    override fun removeSignedPreKey(id: Int) { signedPreKeys.remove(id) }
    override fun storeSignedPreKey(id: Int, prekey: SignedPreKeyRecord) { signedPreKeys[id] = prekey }

    /********* IDENTITIES *********/

    internal val ownIdentityKeypair = KeyUtil.genIdentityKeyPair()
    internal val ownLocalRegistrationId = KeyUtil.genRegistrationId()

    override fun getIdentityKeyPair(): IdentityKeyPair = ownIdentityKeypair
    override fun getLocalRegistrationId(): Int = ownLocalRegistrationId

    val identities: MutableMap<SignalProtocolAddress, IdentityKey> = mutableMapOf()

    override fun getIdentity(address: SignalProtocolAddress) = identities[address]

    override fun isTrustedIdentity(
        address: SignalProtocolAddress,
        identityKey: IdentityKey,
        direction: IdentityKeyStore.Direction
    ): Boolean =
        // trust a key on first use, otherwise only trust it if we've seen it before
        identities[address]?.let { it == identityKey } ?: true

    override fun saveIdentity(address: SignalProtocolAddress, identityKey: IdentityKey): Boolean {
        val replacesPreviousIdentity = identities.contains(address)
        identities[address] = identityKey
        return replacesPreviousIdentity
    }

    /********* SESSIONS *********/

    var sessions: MutableMap<SignalProtocolAddress, SessionRecord> = mutableMapOf()

    override fun containsSession(address: SignalProtocolAddress): Boolean = sessions.contains(address)
    override fun deleteSession(address: SignalProtocolAddress) { sessions.remove(address) }
    override fun deleteAllSessions(name: String?) =
        with(sessions.iterator()) { forEach { if (it.key.name == name) remove() } }
    override fun getSubDeviceSessions(name: String): MutableList<Int> =
        sessions.keys.filter { it.name == name }.map { it.deviceId }.toMutableList()

    override fun loadSession(address: SignalProtocolAddress): SessionRecord =
        // return a copy of an existing session record, or make a fresh session
        sessions[address]?.let { SessionRecord(it.serialize()) } ?: SessionRecord()

    override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) = sessions.set(address, record)
}
