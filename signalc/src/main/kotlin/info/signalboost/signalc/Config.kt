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
    const val USER_PHONE_NUMBER = "+17347962920"

    private val appComponents = listOf(
        // resources
        AccountStore::class,
        ProtocolStore::class,
        //UnixServerSocket::class,
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

    data class Socket(
        val path: String,
    )

    // FACTORIES

    enum class Env(val value: String) {
        Dev("development"),
        Prod("production"),
        Test("test"),
    }

    fun fromEnv(env: String? = System.getenv("SIGNALC_ENV")): App = when(env) {
        Env.Dev.value -> dev
        Env.Prod.value -> prod
        Env.Test.value -> mockStore
        else -> throw(Error("ERROR: missing or illegal value for \$SIGNALC_ENV: $env"))
    }

    private val dbHost = System.getenv("DB_HOST") ?: "localhost:5432"

    private val default  = App(
        db = Database(
            driver = "com.impossibl.postgres.jdbc.PGDriver",
            url = "jdbc:pgsql://$dbHost/signalc",
            user= "postgres"
        ),
        signal= Signal(
            addSecurityProvider = true,
            agent = "signalc",
            cdnUrl = "https://cdn.signal.org",
            cdn2Url = "https://cdn2.signal.org",
            contactDiscoveryUrl = "https://cms.souqcdn.com",
            keyBackupServiceUrl = "https://api.backup.signal.org",
            serviceUrl = "https://textsecure-service.whispersystems.org",
            storageUrl = "https://storage.signal.org",
            trustStorePassword = System.getenv("WHISPER_STORE_PASSWORD") ?: "whisper",
            trustStorePath = System.getenv("WHISPER_STORE_PATH") ?: "/signalc/whisper.store",
            unidentifiedSenderTrustRoot = "BXu6QIKVz5MA8gstzfOgRQGqyLqOwNKHL6INkv3IHWMF",
            zkGroupServerPublicParams = "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0=",
        ),
        socket = Socket(
          path = "/signalc/sock/signald.sock"
        ),
        mocked = emptySet(),
    )

    val prod = default

    val dev = default.copy(
        db = default.db.copy(
            url = "jdbc:pgsql://$dbHost/signalc_development",
        ),
    )

    val test = default.copy(
        db = default.db.copy(
            url = "jdbc:pgsql://$dbHost/signalc_test",
        ),
        socket = default.socket.copy(
            path = "/signalc/sock/test.sock"
        ),
    )

    fun withMocked(mockTargets: List<KClass<out Any>>) = test.copy(
        mocked = mockTargets.toSet()
    )

    fun withMocked(vararg mockTargets: KClass<out Any>) = withMocked(mockTargets.toList())

    val mockAll = withMocked(appComponents)

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
