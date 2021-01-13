package info.signalboost.signalc

import com.charleskorn.kaml.Yaml
import kotlinx.serialization.*
import java.io.File
import kotlin.system.exitProcess

object Config {
    const val USER_PHONE_NUMBER = "+17347962920"
    // NOTE: for signalc to run outside docker, you must export project root as an env var
    val projectRoot: String = System.getenv("SIGNALC_PROJECT_ROOT") ?: run {
        println("\$SIGNALC_PROJECT_ROOT must be defined. Aborting.")
        exitProcess(1)
    }

    enum class Env(val value: String) {
        Default("default"),
        Dev("dev"),
        Test("test"),
        Prod("prod"),
    }

    fun fromEnv(env: Env): App = fromEnvs(listOf(Env.Default,env))

    fun fromEnvs(envs: List<Env>): App =
        envs
            .map { File("${projectRoot}/config.${it.value}.yml").readText(Charsets.UTF_8) }
            .let { fromYamls(it) }

    fun fromYamls(yamls: List<String>): App =
        yamls.fold(AppYaml.empty) { acc, yaml ->
            acc.merge(
                Yaml.default.decodeFromString(AppYaml.serializer(), yaml)
            )
        }.unwrap()

    val prod: App by lazy { fromEnvs(listOf(Env.Default)) }
    val dev: App by lazy { fromEnv(Env.Dev) }
    val test : App by lazy { fromEnv(Env.Test) }

    // TODO(aguestuser|2021-01-13):
    //   HOLY CRAP this is a lot of boilerplate! look into how we could use reflection to DRY it up?

    data class App(
        val db: Database,
        val signal: Signal,
        val store: Store,
    )

    @Serializable
    data class AppYaml(
        val db: DatabaseYaml? = null,
        val signal: SignalYaml? = null,
        val store: StoreYaml? = null,
    ) {
        companion object {
            val empty = AppYaml(
                null,
                null,
                null,
            )

        }
        fun unwrap() = App(
            db!!.unwrap(),
            signal!!.unwrap(),
            store!!.unwrap(),
        )
        fun merge(other: AppYaml) = AppYaml(
            db = db?.merge(other.db) ?: other.db,
            signal = signal?.merge(other.signal) ?: other.signal,
            store = store?.merge(other.store) ?: other.store,
        )
    }

    data class Database(
        val driver: String,
        val url: String,
        val user: String,
    )

    @Serializable
    data class DatabaseYaml(
        val driver: String? = null,
        val url: String? = null,
        val user: String? = null,
    ) {
        fun unwrap() = Database(
            driver = driver!!,
            url = url!!,
            user = user!!,
        )

        fun merge(other: DatabaseYaml?) = DatabaseYaml(
            driver = other?.driver ?: driver,
            url = other?.url ?: url,
            user = other?.user ?: user,
        )
    }

    data class Signal(
        val addSecurityProvider: Boolean,
        val agent: String,
        val trustStorePath: String,
        val trustStorePassword: String,
        val zkGroupServerPublicParams: String,
        val serviceUrl: String,
        val cdnUrl: String,
        val cdn2Url: String,
        val contactDiscoveryUrl: String,
        val keyBackupServiceUrl: String,
        val storageUrl: String,
    )

    @Serializable
    data class SignalYaml(
        val addSecurityProvider: Boolean? = null,
        val agent: String? = null,
        val trustStorePath: String? = null,
        val trustStorePassword: String? = null,
        val zkGroupServerPublicParams: String? = null,
        val serviceUrl: String? = null,
        val cdnUrl: String? = null,
        val cdn2Url: String? = null,
        val contactDiscoveryUrl: String? = null,
        val keyBackupServiceUrl: String? = null,
        val storageUrl: String? = null,
    ) {
        fun unwrap() = Signal(
            addSecurityProvider = addSecurityProvider!!,
            agent = agent!!,
            trustStorePath = trustStorePath!!,
            trustStorePassword = trustStorePassword!!,
            zkGroupServerPublicParams = zkGroupServerPublicParams!!,
            serviceUrl = serviceUrl!!,
            cdnUrl = cdnUrl!!,
            cdn2Url = cdn2Url!!,
            contactDiscoveryUrl = contactDiscoveryUrl!!,
            keyBackupServiceUrl = keyBackupServiceUrl!!,
            storageUrl = storageUrl!!,
        )
        fun merge(other: SignalYaml?) = SignalYaml(
            addSecurityProvider = other?.addSecurityProvider ?: addSecurityProvider,
            agent = other?.agent ?: agent,
            trustStorePath = other?.trustStorePath ?: trustStorePath,
            trustStorePassword = other?.trustStorePassword ?: trustStorePassword,
            zkGroupServerPublicParams = other?.zkGroupServerPublicParams ?: zkGroupServerPublicParams,
            serviceUrl = other?.serviceUrl ?: serviceUrl,
            cdnUrl = other?.cdnUrl ?: cdnUrl,
            cdn2Url = other?.cdn2Url ?: cdn2Url,
            contactDiscoveryUrl = other?.contactDiscoveryUrl ?: contactDiscoveryUrl,
            keyBackupServiceUrl = other?.keyBackupServiceUrl ?: keyBackupServiceUrl,
            storageUrl = other?.storageUrl ?: storageUrl,
        )
    }

    enum class StoreType(value: String) {
        SQL("SQL"),
        MOCK("MOCK"),
    }


    data class Store(
        val account: StoreType,
        val signalProtocol: StoreType,
    )

    @Serializable
    data class StoreYaml(
        val account: StoreType? = null,
        val signalProtocol: StoreType? = null,
    ) {
        fun unwrap() = Store(
            account = account!!,
            signalProtocol = signalProtocol!!,
        )
        fun merge(other: StoreYaml?) = StoreYaml(
            account = other?.account ?: account,
            signalProtocol = other?.signalProtocol ?: signalProtocol,
        )
    }

}
