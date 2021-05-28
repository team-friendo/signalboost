package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genDeviceId
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuid
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genLong
import org.signal.client.internal.Native
import org.signal.libsignal.metadata.certificate.InvalidCertificateException
import org.signal.libsignal.metadata.certificate.SenderCertificate
import org.signal.libsignal.metadata.certificate.ServerCertificate
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.ecc.Curve.generateKeyPair
import org.whispersystems.libsignal.ecc.ECKeyPair
import org.whispersystems.libsignal.ecc.ECPublicKey
import java.util.*


object CertGen {
    @Throws(InvalidKeyException::class, InvalidCertificateException::class)
    fun genSenderCert(
        trustRoot: ECKeyPair = generateKeyPair(),
        uuid: UUID = genUuid(),
        e164: String = genPhoneNumber(),
        deviceId: Int = genDeviceId(),
        identityKey: ECPublicKey = generateKeyPair().publicKey,
        expires: Long = genLong(),
    ): SenderCertificate {
        val serverKey: ECKeyPair = generateKeyPair()
        val serverCertificate = ServerCertificate(
            Native.ServerCertificate_New(
                1,
                serverKey.publicKey.nativeHandle(),
                trustRoot.privateKey.nativeHandle()
            )
        )
        return SenderCertificate(
            Native.SenderCertificate_New(
                uuid.toString(), e164, deviceId, identityKey.nativeHandle(), expires,
                serverCertificate.nativeHandle(), serverKey.privateKey.nativeHandle()
            )
        )
    }
}