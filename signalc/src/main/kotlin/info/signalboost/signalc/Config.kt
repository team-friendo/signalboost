package info.signalboost.signalc

import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.groupsv2.ClientZkOperations
import org.whispersystems.signalservice.api.groupsv2.GroupsV2Operations
import org.whispersystems.signalservice.api.push.TrustStore
import org.whispersystems.signalservice.internal.configuration.*
import java.io.FileInputStream
import java.io.InputStream
import org.whispersystems.util.Base64

object Config {

    // TODO(aguestuser|2020-12-01): move some of these to build.gradle and read their values from env vars?

    const val SIGNAL_AGENT = "signalc"


    private const val ZK_GROUP_SERVER_PUBLIC_PARAMS = "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0="
    private const val SIGNAL_SERVICE_URL = "https://textsecure-service.whispersystems.org"
    private const val SIGNAL_CDN_URL = "https://cdn.signal.org"
    private const val SIGNAL_CDN2_URL = "https://cdn2.signal.org"
    private const val SIGNAL_CONTACT_DISCOVERY_URL = "https://cms.souqcdn.com"
    private const val SIGNAL_KEY_BACKUP_SERVICE_URL = "https://api.backup.signal.org"
    private const val SIGNAL_STORAGE_URL = "https://storage.signal.org"

    object SignalcTrustStore : TrustStore {
        override fun getKeyStoreInputStream(): InputStream = FileInputStream(KEYSTORE_PATH)
        override fun getKeyStorePassword(): String = "whisper"
    }

    val signalServiceConfig = SignalServiceConfiguration(
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

    val groupsV2Operations: GroupsV2Operations?
      get() = try {
          GroupsV2Operations(ClientZkOperations.create(signalServiceConfig))
      } catch (ignored: Throwable) {
          null
      }
}
