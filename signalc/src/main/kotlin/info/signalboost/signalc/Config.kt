package info.signalboost.signalc

import com.charleskorn.kaml.Yaml
import kotlinx.serialization.*
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.Contextual
import org.h2.util.JdbcUtils.serializer
import java.io.File
import kotlin.system.exitProcess

object Config {
    // CONSTANTS

    const val USER_PHONE_NUMBER = "+17347962920"
    val projectRoot: String = System.getenv("SIGNALC_PROJECT_ROOT") ?: run {
        println("\$SIGNALC_PROJECT_ROOT must be defined. Aborting.")
        exitProcess(1)
    }

    // FACTORIES

    enum class Env(val value: String) {
        Default("default"),
        Dev("dev"),
        Test("test"),
        Prod("prod"),
    }

    val prod: App by lazy { fromEnvs(listOf(Env.Default)) }
    val dev: App by lazy { fromEnv(Env.Dev) }
    val test : App by lazy { fromEnv(Env.Test) }

    fun fromEnv(env: Env): App = fromEnvs(listOf(Env.Default,env))

    fun fromEnvs(envs: List<Env>): App =
        envs
            .map { File("${projectRoot}/config.${it.value}.yml").readText(Charsets.UTF_8) }
            .let { fromYamls(it) }

    // Merge configs from an arbitrarily long sequence of yaml files such that:
    // (1) the first yaml in the list will be considered the "base" (and should provide defautls for all fields)
    // (2) subsequent yamls may override fields from the base yaml
    // (3) subsequent yamls may only specify a subset of all fiels (so long as all fields are defined in the base)
    // -
    // inspired by: https://github.com/bodylabs/misty-config
    fun fromYamls(yamls: List<String>): App =
        yamls
            // this naive approach doesn't compile (yields: Serializer for class 'Any' is not found.)
            // .map { Yaml.default.decodeFromString(serializer(), it) as HashMap<String,Any> }
            // ---
            // but this less naive approach ALSO doesn't compile (see below)
            .map { myYamlModule.decodeFromString(serializer<HashMap<String,@Contextual Any>>(), it) as HashMap<String,Any> }
            .reduce { acc, item -> acc.merge(item) }
            .toConfig()

    // this attempated solution (as per https://github.com/Kotlin/kotlinx.serialization/issues/1019)
    // yields:
    // ```
    // Unresolved reference. None of the following candidates is applicable because of receiver type mismatch:
    // public fun String.compareTo(other: String, ignoreCase: Boolean = ...): Int defined in kotlin.text
    // ```
    val myYamlModule = Yaml(
        serializersModule = SerializersModule {
            contextual(String::class, String.serializer())
            contextual(String::class, String.serializer())
            contextual(Int::class, Int.serializer())
            contextual(Boolean::class, Boolean.serializer())
            // compile error triggered on this line --v
            contextual(
                HashMap::class,
                serializer<HashMap<String,@Contextual Any>()
            )
        }
    )


    // CONFIG SCHEMA

    data class App(
        val db: Database,
        val signal: Signal,
        val store: Store,
    )

    data class Database(
        val driver: String,
        val url: String,
        val user: String,
    )

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

    enum class StoreType(value: String) {
        SQL("SQL"),
        MOCK("MOCK"),
    }

    data class Store(
        val account: StoreType,
        val signalProtocol: StoreType,
    )

    // GLUE CODE (for merging hash maps and coercing them to the the config schema)

    @Suppress("UNCHECKED_CAST")
    fun HashMap<String,Any>.toConfig(): App {

        val db = this["db"] as HashMap<String, Any>
        val signal = this["signal"] as HashMap<String, Any>
        val store = this["store"] as HashMap<String, Any>

        fun HashMap<String,Any>.unwrap(value: Any): Any = this[value]!!.let {
            if(it is String){
                if(it[0] == '$') return System.getenv(it.substring(1))!!
                if(it == "SQL") return StoreType.SQL
                if(it == "MOCK") return StoreType.MOCK
            }
            return it
        }

        // TODO: consider some sort of meta-programming to clean this up...
        return App(
            db = Database(
                driver = db.unwrap("driver") as String,
                url = db.unwrap("url") as String,
                user = db.unwrap("user") as String,
            ),
            signal = Signal(
                addSecurityProvider = db.unwrap("addSecurityProvider") as Boolean,
                agent = signal.unwrap("agent") as String,
                trustStorePath = signal.unwrap("trustStorePath") as String,
                trustStorePassword = signal.unwrap("trustStorePassword") as String,
                zkGroupServerPublicParams = signal.unwrap("zkGroupServerPublicParams") as String,
                serviceUrl = signal.unwrap("serviceUrl") as String,
                cdnUrl = signal.unwrap("cdnUrl") as String,
                cdn2Url = signal.unwrap("cdn2Url") as String,
                contactDiscoveryUrl = signal.unwrap("contactDiscoveryUrl") as String,
                keyBackupServiceUrl = signal.unwrap("keyBackupServiceUrl") as String,
                storageUrl = signal.unwrap("storageUrl") as String,

                ),
            store = Store(
                account = store.unwrap("account") as StoreType,
                signalProtocol = store.unwrap("signalProtocol") as StoreType,
            ),
        )
    }

    @Suppress("UNCHECKED_CAST")
    fun HashMap<String,Any>.merge(other: HashMap<String,Any>): HashMap<String,Any> =
        this.mapValues {
            when(val otherValue = other[it.key]) {
                is HashMap<*,*> -> (it.value as HashMap<String,Any>).merge(otherValue as HashMap<String, Any>)
                null -> it.value
                else -> otherValue
            }
        } as HashMap<String, Any>

}
