package info.signalboost.signalc.logic

import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.SignedPreKeyRecord
import org.whispersystems.libsignal.util.KeyHelper
import org.whispersystems.util.Base64
import java.security.SecureRandom

object KeyUtil {
    // random byte generators
    private fun genRandomBytes(n: Int): ByteArray {
        val bytes = ByteArray(size = n)
        SecureRandom.getInstance("SHA1PRNG").nextBytes(bytes)
        return bytes
    }
    fun genSignalingKey(): String = Base64.encodeBytes(genRandomBytes(52))
    fun genPassword(): String = Base64.encodeBytes(genRandomBytes(18))
    fun genProfileKey(): ProfileKey = ProfileKey(genRandomBytes(32))

    // delegations to signal's key helper lib
    fun genIdentityKeyPair(): IdentityKeyPair = KeyHelper.generateIdentityKeyPair()
    fun genPreKeys(start: Int, count: Int): List<PreKeyRecord> = KeyHelper.generatePreKeys(start, count)
    fun genRegistrationId(): Int = KeyHelper.generateRegistrationId(false)
    fun genSignedPreKey(identityKeyPair: IdentityKeyPair, signedPreKeyId: Int): SignedPreKeyRecord =
        KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId)
}