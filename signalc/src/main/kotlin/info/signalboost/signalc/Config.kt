package info.signalboost.signalc

import info.signalboost.signalc.logic.*
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.ProtocolStore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlin.reflect.KClass
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
object Config {
    const val FAKE_SIGNAL_SERVER_URL = "https://signalserver.signalboost.info"
    const val FAKE_SIGNAL_SERVER_TRUSTSTORE_PATH = "fake.whisper.store"

    private val appComponents = listOf(
        // resources
        AccountStore::class,
        ProtocolStore::class,
        // components
        AccountManager::class,
        // note: we exclude Signal::class b/c currently we never need to mock it
        SignalReceiver::class,
        SignalSender::class,
        SocketReceiver::class,
        SocketSender::class,
        SocketServer::class,
    )

    // SCHEMA

    data class App(
        val db: Database,
        val signal: Signal,
        val socket: Socket,
        val threads: Threads,
        /*******************************/
        val mocked: Set<KClass<out Any>>,
    )

    data class Database(
        val driver: String,
        val url: String,
        val user: String,
    )

    data class Signal(
        val addSecurityProvider: Boolean,
        val agent: String,
        val cdnUrl: String,
        val cdn2Url: String,
        val contactDiscoveryUrl: String,
        val keyBackupServiceUrl: String,
        val serviceUrl: String,
        val storageUrl: String,
        val trustStorePassword: String,
        val trustStorePath: String,
        val unidentifiedSenderTrustRoot: String,
        val zkGroupServerPublicParams: String,
    )

    data class Threads(
        val perProcessor: Int,
    )

    data class Socket(
        val path: String,
    )

    // FACTORY HELPERS

    enum class Env(val value: String) {
        Dev("development"),
        Prod("production"),
        Test("test"),
        Load("load"),
    }

    fun fromEnv(env: String? = System.getenv("SIGNALC_ENV")): App =
        when(env) {
            Env.Dev.value -> dev
            Env.Prod.value -> prod
            Env.Test.value -> mockStore
            Env.Load.value -> load
            else -> throw(Error("ERROR: missing or illegal value for \$SIGNALC_ENV: $env"))
        }
    private val dbName = System.getenv("SIGNALC_DB_NAME")
        ?: when(System.getenv("SIGNALC_ENV")) {
            Env.Dev.value -> "signalc_development"
            Env.Test.value -> "signalc_test"
            Env.Load.value -> "loadtest_sender_signalc"
            else -> "signalc"
        }

    private val dbHost = System.getenv("DB_HOST") ?: "localhost:5432"

    private val default  = App(
        db = Database(
            driver = "com.impossibl.postgres.jdbc.PGDriver",
            url = "jdbc:pgsql://$dbHost/$dbName",
            user= "postgres"
        ),
        signal= Signal(
            addSecurityProvider = true,
            agent = "signalc",
            cdnUrl = System.getenv("SIGNAL_CDN_URL") ?: "https://cdn.signal.org",
            cdn2Url = System.getenv("SIGNAL_CDN2_URL") ?: "https://cdn2.signal.org",
            contactDiscoveryUrl = System.getenv("SIGNAL_CONTACTS_URL") ?: "https://cms.souqcdn.com",
            keyBackupServiceUrl = System.getenv("SIGNAL_BACKUPS_URL") ?: "https://api.backup.signal.org",
            serviceUrl = System.getenv("SIGNAL_SERVICE_URL") ?: "https://textsecure-service.whispersystems.org",
            storageUrl = System.getenv("SIGNAL_STORAGE_URL") ?: "https://storage.signal.org",
            trustStorePassword = System.getenv("WHISPER_STORE_PASSWORD") ?: "whisper",
            trustStorePath = System.getenv("WHISPER_STORE_PATH") ?: "whisper.store",
            unidentifiedSenderTrustRoot = System.getenv("SIGNAL_UNIDENTIFIED_SENDER_TRUST_ROOT") ?: "BXu6QIKVz5MA8gstzfOgRQGqyLqOwNKHL6INkv3IHWMF",
            zkGroupServerPublicParams = System.getenv("SIGNAL_ZKGROUP_PUBLIC_PARAMS") ?: "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0=",
        ),
        socket = Socket(
          path = "/signalc/sock/signald.sock"
        ),
        threads = Threads(
            perProcessor = 128,
        ),
        mocked = emptySet(),
    )

    // FACTORIES

    val prod = default
    val dev = default
    val test = default.copy(
        socket = default.socket.copy(
            path = "/signalc/sock/test.sock"
        ),
        threads = default.threads.copy(
            perProcessor = 64
        ),
    )
    val load = default.copy(
        signal = default.signal.copy(
            serviceUrl = FAKE_SIGNAL_SERVER_URL,
            trustStorePath = FAKE_SIGNAL_SERVER_TRUSTSTORE_PATH,
        )
    )

    fun withMocked(mockTargets: List<KClass<out Any>>) = test.copy(
        mocked = mockTargets.toSet()
    )

    fun withMocked(vararg mockTargets: KClass<out Any>) = withMocked(mockTargets.toList())

    val mockStore = withMocked(
        AccountStore::class,
        ProtocolStore::class
    )

    fun mockAllExcept(unmocked: KClass<out Any>): App =
        withMocked(appComponents.filter { it != unmocked })

    fun mockAllExcept(vararg unmocked: KClass<out Any>): App {
        val _unmocked: Set<KClass<out Any>> = unmocked.toSet()
        return withMocked(appComponents.filter { !_unmocked.contains(it) })
    }

}
