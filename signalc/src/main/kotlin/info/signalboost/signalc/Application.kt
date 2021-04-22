package info.signalboost.signalc

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import info.signalboost.signalc.logging.LibSignalLogger
import info.signalboost.signalc.logic.*
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.EnvelopeStore
import info.signalboost.signalc.store.ProtocolStore
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.*
import mu.KLoggable
import okhttp3.internal.closeQuietly
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jetbrains.exposed.sql.Database
import org.signal.libsignal.metadata.certificate.CertificateValidator
import org.whispersystems.libsignal.ecc.Curve
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.groupsv2.ClientZkOperations
import org.whispersystems.signalservice.api.groupsv2.GroupsV2Operations
import org.whispersystems.signalservice.api.push.TrustStore
import org.whispersystems.signalservice.internal.configuration.*
import org.whispersystems.util.Base64
import java.io.InputStream
import java.security.Security
import kotlin.io.path.ExperimentalPathApi
import kotlin.reflect.KClass
import kotlin.reflect.full.primaryConstructor
import kotlin.system.exitProcess
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ExperimentalPathApi
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class Application(val config: Config.App){
    companion object: Any(), KLoggable {
        override val logger = logger()
        val availableProcessors by lazy {
            Runtime.getRuntime().availableProcessors()
        }
        val queueParallelism = availableProcessors + 1
        val connectionPoolParallelism = (2 * availableProcessors) + 1
        val maxParallelism = availableProcessors * 256
    }
    init {
        Security.addProvider(BouncyCastleProvider())
        System.setProperty(IO_PARALLELISM_PROPERTY_NAME,"$maxParallelism")
        LibSignalLogger.init()
    }

    /**************
     * COMPONENTS
     *************/

    lateinit var accountManager: AccountManager
    lateinit var signalSender: SignalSender
    lateinit var signalReceiver: SignalReceiver
    lateinit var socketReceiver: SocketReceiver
    lateinit var socketSender: SocketSender
    lateinit var socketServer: SocketServer

    /*************
     * RESOURCES
     ************/

    // COROUTINES //

    lateinit var coroutineScope: CoroutineScope

    // SIGNAL //

    data class Signal(
        val agent: String,
        val attachmentsPath: String,
        val certificateValidator: CertificateValidator,
        val clientZkOperations: ClientZkOperations?,
        val configs: SignalServiceConfiguration,
        val groupsV2Operations: GroupsV2Operations?,
        val trustStore: TrustStore,
    )

    lateinit var signal: Signal

    private fun initializeSignal(): Signal = Signal(
        agent = config.signal.agent,
        attachmentsPath = config.signal.attachmentsPath,
        certificateValidator = certificateValidator,
        clientZkOperations = clientZkOperations,
        configs = signalConfigs,
        groupsV2Operations = groupsV2Operations,
        trustStore = trustStore,
    )

    private val trustStore by lazy {
        object : TrustStore {
            override fun getKeyStoreInputStream(): InputStream = {}::class.java.getResourceAsStream(
                config.signal.trustStorePath
            )!!
            override fun getKeyStorePassword(): String = config.signal.trustStorePassword
        }
    }

    private val signalConfigs by lazy {
        SignalServiceConfiguration(
            arrayOf(SignalServiceUrl(config.signal.serviceUrl, trustStore)),
            mapOf(
                0 to arrayOf(SignalCdnUrl(config.signal.cdnUrl, trustStore)),
                2 to arrayOf(SignalCdnUrl(config.signal.cdn2Url, trustStore))
            ).toMutableMap(),
            arrayOf(SignalContactDiscoveryUrl(config.signal.contactDiscoveryUrl, trustStore)),
            arrayOf(SignalKeyBackupServiceUrl(config.signal.keyBackupServiceUrl, trustStore)),
            arrayOf(SignalStorageUrl(config.signal.storageUrl, trustStore)),
            mutableListOf(), // interceptors
            Optional.absent(), // dns
            Optional.absent(), // proxy
            Base64.decode(config.signal.zkGroupServerPublicParams)
        )
    }

    private val clientZkOperations: ClientZkOperations? by lazy {
        try {
            ClientZkOperations.create(signalConfigs)
        } catch(ignored: Throwable) {
            null
        }
    }

    private val groupsV2Operations: GroupsV2Operations? by lazy {
        clientZkOperations?.let { GroupsV2Operations(it) }
    }

    private val certificateValidator: CertificateValidator by lazy {
        // TODO: what to do if this throws invalid key exception or io exception?
        CertificateValidator(Curve.decodePoint(Base64.decode(config.signal.unidentifiedSenderTrustRoot), 0))
    }


    // STORE //

    lateinit var accountStore: AccountStore
    lateinit var envelopeStore: EnvelopeStore
    lateinit var protocolStore: ProtocolStore

    private lateinit var dataSource: HikariDataSource
    private val db by lazy {
        Database.connect(dataSource)
    }

    /**************
     * LIFECYCLE
     *************/

    // INITIALIZERS

    private fun initializeDataSource(mockAnswers: HikariDataSource.() -> Unit = {}):  HikariDataSource =
        if(config.mocked.contains(HikariDataSource::class)) mockk(block = mockAnswers)
        else HikariDataSource(
            HikariConfig().apply {
                driverClassName = config.db.driver
                jdbcUrl = config.db.url
                username = config.db.user
                // as per: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
                maximumPoolSize = connectionPoolParallelism
                isAutoCommit = false
                validate()
            }
        )


    private inline fun <reified T: Any>initializeStore(
        component: KClass<T>,
        mockAnswers: T.() -> Unit = {}
    ):  T =
        if(config.mocked.contains(component)) mockk(block = mockAnswers)
        else (component.primaryConstructor!!::call)(arrayOf(db))


    private inline fun <reified T: Any>initializeColdComponent(
        component: KClass<T>,
        mockAnswers: T.() -> Unit = {}
    ):  T =
        if(config.mocked.contains(component)) mockk(block = mockAnswers)
        else (component.primaryConstructor!!::call)(arrayOf(this@Application))

    interface ReturningRunnable<T> {
        suspend fun run(): T
    }

    private inline fun <reified U: Any, reified T: ReturningRunnable<U>>initializeHotComponent(
        component: KClass<T>,
        mockAnswers: T.() -> Unit = { coEvery { run() } returns mockk() }
    ): T =
        if(config.mocked.contains(component)) mockk(block = mockAnswers)
        else (component.primaryConstructor!!::call)(arrayOf(this@Application))


    // PUBLIC METHODS

    @ExperimentalCoroutinesApi
    suspend fun run(scope: CoroutineScope): Application {
        /***
         * This method does 2 things:
         *
         * - (1) turns the app "on" from a unitialized/inert state to an initialized/running state
         * - (2) allows us to vary how app components are initialized at runtime based on configs
         *
         * Notably, this initialization/configuration transition provides a seam where we can mock
         * an arbitrary subset of app components, or set the app into various test-friendly configurations,
         * which is the purpose of the initializer functions and the set of default `Mocks` provided below.
         *
         * For more on how we leverage this configuration seam, grep `//FACTORIES` in Config.kt...
         ***/

        logger.info("Booting...")
        logger.debug("(in debug mode)")

        /***
         * concurrency context
         * --------------------
         * NOTE: we declare a supervisor job so that failure of a child coroutine won't cause
         * the app's parent job (and thus all other child coroutines in the app) to be cancelled.
         * see: https://kotlinlang.org/docs/exception-handling.html#supervision-job
         ***/
        coroutineScope = scope + SupervisorJob()

        // storage resources
        dataSource = initializeDataSource(Mocks.dataSource)
        accountStore = initializeStore(AccountStore::class)
        envelopeStore = initializeStore(EnvelopeStore::class, Mocks.envelopeStore)
        protocolStore = initializeStore(ProtocolStore::class, Mocks.protocolStore)

        // network resources
        signal = initializeSignal()

        // "cold" components
        accountManager = initializeColdComponent(AccountManager::class, Mocks.accountManager)
        signalReceiver = initializeColdComponent(SignalReceiver::class, Mocks.signalReceiver)
        signalSender = initializeColdComponent(SignalSender::class, Mocks.signalSender)
        socketReceiver = initializeColdComponent(SocketReceiver::class, Mocks.socketReceiver)
        socketSender = initializeColdComponent(SocketSender::class, Mocks.socketSender)

        // "hot" components
        socketServer = initializeHotComponent(SocketServer::class, Mocks.socketServer).run()

        // handle SIGTERM gracefully
        Runtime.getRuntime().addShutdownHook(object : Thread() {
            override fun run() {
                runBlocking {
                    this@Application.stop()
                }
            }
        })

        logger.info("...Running!")
        return this
    }

    suspend fun stop(): Application {
        logger.info { "Stopping application..."}
        socketServer.stop()
        dataSource.closeQuietly()
        signalSender.drain().let { (didDrain, numToDrain, numDropped) ->
            if(didDrain) logger.info { "SignaldSender drained $numToDrain messages before shutdown."}
            else logger.error { "SignalSender failed to drain $numToDrain messages before shutdown. $numDropped messages dropped."}
        }
        logger.info { "...application stopped!"}
        return this
    }

    fun exit() {
        if(config.toggles.shouldExit) exitProcess(1)
    }
}


