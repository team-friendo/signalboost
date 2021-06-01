package info.signalboost.signalc.util

import org.signal.zkgroup.InvalidInputException
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.ecc.Curve
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.SignedPreKeyRecord
import org.whispersystems.libsignal.util.KeyHelper
import org.whispersystems.libsignal.util.Medium
import org.whispersystems.signalservice.api.kbs.MasterKey
import org.whispersystems.util.Base64
import java.security.SecureRandom
import java.util.*

object KeyUtil {
    // UUID generators (For testing seam)
    fun genUuidStr(): String = UUID.randomUUID().toString()

    // random byte generators
    fun genRandomBytes(n: Int): ByteArray {
        val bytes = ByteArray(size = n)
        SecureRandom.getInstance("SHA1PRNG").nextBytes(bytes)
        return bytes
    }

    fun genSignalingKey(): String = Base64.encodeBytes(genRandomBytes(52))
    fun genPassword(): String = Base64.encodeBytes(genRandomBytes(18))
    fun genProfileKey(): ProfileKey = ProfileKey(genRandomBytes(32))
    fun genProfileKeyBytes(): ByteArray = genRandomBytes(32)
    fun genRegistrationId(): Int = KeyHelper.generateRegistrationId(false)

    // The following three functions were pulled from: https://github.com/signalapp/Signal-Android/blob/master/app/src/main/java/org/thoughtcrime/securesms/crypto/IdentityKeyUtil.java
    fun genIdentityKeyPair(): IdentityKeyPair {
        val djbKeyPair = Curve.generateKeyPair()
        return IdentityKeyPair(IdentityKey(djbKeyPair.publicKey), djbKeyPair.privateKey)
    }

    fun genPreKeys(offset: Int, batchSize: Int): List<PreKeyRecord> {
        val records = ArrayList<PreKeyRecord>(batchSize)
        for (i in 0 until batchSize) {
            val preKeyId = (offset + i) % Medium.MAX_VALUE
            val keyPair = Curve.generateKeyPair()
            val record = PreKeyRecord(preKeyId, keyPair)
            records.add(record)
        }
        return records
    }

    fun genSignedPreKey(identityKeyPair: IdentityKeyPair, signedPreKeyId: Int): SignedPreKeyRecord {
        val keyPair = Curve.generateKeyPair()
        val signature: ByteArray
        signature = try {
            Curve.calculateSignature(identityKeyPair.privateKey, keyPair.publicKey.serialize())
        } catch (e: InvalidKeyException) {
            throw AssertionError(e)
        }
        return SignedPreKeyRecord(signedPreKeyId, System.currentTimeMillis(), keyPair, signature)
    }
}