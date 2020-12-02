import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.*
import org.whispersystems.libsignal.util.KeyHelper
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceAccountManager
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccess
import org.whispersystems.signalservice.api.groupsv2.ClientZkOperations
import org.whispersystems.signalservice.api.groupsv2.GroupsV2Operations
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.profiles.SignalServiceProfile
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.api.push.TrustStore
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import org.whispersystems.signalservice.internal.configuration.*
import org.whispersystems.signalservice.internal.util.DynamicCredentialsProvider
import org.whispersystems.util.Base64
import java.io.FileInputStream
import java.io.InputStream
import java.security.SecureRandom
import java.security.Security
import java.time.Instant
import java.util.*

/********************************************************************
 * DEV-CONFIGURABLE VALUES (CHANGE TO RUN SPIKE CODE ON YOUR LAPTOP)
 *******************************************************************/
const val USER_PHONE_NUMBER = "+17347962920"
const val KEYSTORE_PATH = "/home/aguestuser/-/team-friendo/code/signalc/whisper.store" // read from `pwd`?
const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day

/**************
 * CONSTANTS
 **************/

// TODO(aguestuser|2020-12-01):
//  eventually put these in build configs or some such (and make them less hard-coded)
const val SIGNAL_AGENT = "signalc"
const val ZK_GROUP_SERVER_PUBLIC_PARAMS = "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0="
const val SIGNAL_SERVICE_URL = "https://textsecure-service.whispersystems.org"
const val SIGNAL_CDN_URL = "https://cdn.signal.org"
const val SIGNAL_CDN2_URL = "https://cdn2.signal.org"
const val SIGNAL_CONTACT_DISCOVERY_URL = "https://cms.souqcdn.com"
const val SIGNAL_KEY_BACKUP_SERVICE_URL = "https://api.backup.signal.org"
const val SIGNAL_STORAGE_URL = "https://storage.signal.org"

/***********
 * CONFIGS
 ***********/

object SignalcTrustStore: TrustStore {
    override fun getKeyStoreInputStream(): InputStream = FileInputStream(KEYSTORE_PATH)
    override fun getKeyStorePassword(): String = "whisper"
}

val config = SignalServiceConfiguration(
    arrayOf(SignalServiceUrl(SIGNAL_SERVICE_URL, SignalcTrustStore)),
    mapOf(
        0 to arrayOf(SignalCdnUrl(SIGNAL_CDN_URL, SignalcTrustStore)),
        2 to arrayOf(SignalCdnUrl(SIGNAL_CDN2_URL, SignalcTrustStore))
    ).toMutableMap(),
    arrayOf(SignalContactDiscoveryUrl(SIGNAL_CONTACT_DISCOVERY_URL, SignalcTrustStore)),
    arrayOf(SignalKeyBackupServiceUrl(SIGNAL_KEY_BACKUP_SERVICE_URL, SignalcTrustStore)),
    arrayOf(SignalStorageUrl(SIGNAL_STORAGE_URL, SignalcTrustStore)),
    mutableListOf(),
    absent(),
    Base64.decode(ZK_GROUP_SERVER_PUBLIC_PARAMS)
)

/*******************
 * PROTOCOL STORE
 *******************/

class SignalcProtocolStore: SignalProtocolStore {

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

/**********************
 * ACCOUNT MANAGEMENT
 **********************/

data class Account(
    val username: String,
    val uuid: UUID = UUID.randomUUID(), // TODO: if we use this, Auth w/ signal server fails - why? maybe we need to set UUID on AccountManager?
    val password: String = genPassword(),
    val signalingKey: String = genSignalingKey(),
    val profileKey: ProfileKey = genProfileKey(),
    val deviceId: Int = SignalServiceAddress.DEFAULT_DEVICE_ID,
) {
   val unrestrictedAccesKey: ByteArray
       get() = UnidentifiedAccess.deriveAccessKeyFrom(this.profileKey)
   val asCredentialsProvider: DynamicCredentialsProvider
       get() = DynamicCredentialsProvider(
           // TODO: figure out why providing a UUID breaks authentication, then get rid of this null!
           //  currently we can't use our UUID in the credentials provider b/c it causes signal server to 400 or 401 b/c it wants a e164 number:
           //   - https://github.com/Turasa/libsignal-service-java/blob/master/service/src/main/java/org/whispersystems/signalservice/internal/push/PushServiceSocket.java#L1824
           //   - https://github.com/signalapp/Signal-Server/blob/master/service/src/main/java/org/whispersystems/textsecuregcm/controllers/AccountController.java#L260-L266
           //  this wouldn't happen if either (1) the signal server knew about our UUID, or (2) we didn't default to using it in Auth header...
           null,
           this.username,
           this.password,
           this.signalingKey,
           this.deviceId
       )

}

fun genRandomBytes(n: Int): ByteArray {
    val bytes = ByteArray(size = n)
    SecureRandom.getInstance("SHA1PRNG").nextBytes(bytes)
    return bytes
}

fun genSignalingKey(): String = Base64.encodeBytes(genRandomBytes(52))
fun genPassword(): String =Base64.encodeBytes(genRandomBytes(18))
fun genProfileKey(): ProfileKey = ProfileKey(genRandomBytes(32))

fun groupsV2OperationsOf(serviceConfiguration: SignalServiceConfiguration?): GroupsV2Operations? {
    return try {
        GroupsV2Operations(ClientZkOperations.create(serviceConfiguration))
    } catch (ignored: Throwable) {
        null
    }
}

fun verifyAccount(accountManager: SignalServiceAccountManager, protocolStore: SignalProtocolStore, account: Account, code: String) {
    accountManager.verifyAccountWithCode(
        code,
        null,
        protocolStore.localRegistrationId,
        true,
        null,
        null,
        account.unrestrictedAccesKey,
        false,
        SignalServiceProfile.Capabilities(true, false, false),
        true
    )
}

/********************
 * MESSAGE HELPERS
 ********************/

fun messageSenderOf(account: Account, store: SignalProtocolStore, config: SignalServiceConfiguration) = SignalServiceMessageSender(
    config,
    null, // TODO: why can't we use UUIDs?
    account.username,
    account.password,
    account.deviceId,
    store,
    SIGNAL_AGENT,
    true,
    false,
    absent(),
    absent(),
    absent(),
    null,
    null,
)

fun dataMessageOf(body: String, expiration: Int = DEFAULT_EXPIRY_TIME): SignalServiceDataMessage {
    val timestamp = Instant.now().toEpochMilli()
    return SignalServiceDataMessage.newBuilder()
        .withTimestamp(timestamp)
        .withBody(body)
        .withExpiration(expiration)
        .build()
}

/*************
 * MAIN LOOP
 *************/

fun main() {
    // Workaround for BKS truststore (copied from signald -- keep?)
    Security.addProvider(BouncyCastleProvider())

    // initialize key material
    val protocolStore = SignalcProtocolStore()
    val oneTimePreKeys = KeyHelper.generatePreKeys(0, 100)
    oneTimePreKeys.forEach { protocolStore.storePreKey(it.id, it) }
    val signedPreKey = KeyHelper.generateSignedPreKey(protocolStore.ourIdentityKeyPair, 42)
    val zkGroupOperations = groupsV2OperationsOf(config)

    // intialize account
    val account = Account(username = USER_PHONE_NUMBER)
    val accountManager = SignalServiceAccountManager(
        config,
        account.asCredentialsProvider,
        SIGNAL_AGENT,
        zkGroupOperations,
        UptimeSleepTimer()
    )
    // TODO(aguestuser|2020-12-01): set a profile key here? (only used for zkgroups stuff...)

    println("Asking signal for an sms verification code...")
    accountManager.requestSmsVerificationCode(false, Optional.absent(), Optional.absent())

    println("Please enter the code:")
    val verificationCode = readLine() ?: return

    verifyAccount(accountManager, protocolStore, account, verificationCode)
    accountManager.setPreKeys(protocolStore.ourIdentityKeyPair.publicKey, signedPreKey, oneTimePreKeys)

    println("$USER_PHONE_NUMBER registered and verified!")

    val messageSender = messageSenderOf(account, protocolStore, config)

    while(true){
        println("\nWhat number would you like to send a message to?")
        val recipientPhone = readLine() ?: return

        println("What message would you like to send?")
        val messageBody = readLine() ?: return

        messageSender.sendMessage(
            SignalServiceAddress(null, recipientPhone),
            absent(),
            dataMessageOf(messageBody)
        )

        println("Sent \"$messageBody\" to $recipientPhone\n")
    }
}