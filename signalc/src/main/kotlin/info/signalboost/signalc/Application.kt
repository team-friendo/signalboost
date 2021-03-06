package info.signalboost.signalc

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import com.zaxxer.hikari.metrics.prometheus.PrometheusMetricsTrackerFactory
import info.signalboost.signalc.logging.LibSignalLogger
import info.signalboost.signalc.logic.*
import info.signalboost.signalc.metrics.Metrics
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.ContactStore
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
        val connectionPoolParallelism = (2 * availableProcessors) + 1
        val maxParallelism = availableProcessors * 256
    }
    init {
        Security.addProvider(BouncyCastleProvider())
        System.setProperty(IO_PARALLELISM_PROPERTY_NAME,"$maxParallelism")
        LibSignalLogger.init()
    }

    /**************
     * FIELDS
     *************/

    @Volatile
    var isShuttingDown = false
    val timers = config.timers
    val toggles = config.toggles

    /**************
     * COMPONENTS
     *************/

    lateinit var accountManager: AccountManager
    lateinit var signalSender: SignalSender
    lateinit var signalReceiver: SignalReceiver
    lateinit var socketReceiver: SocketReceiver
    lateinit var socketSender: SocketSender
    lateinit var socketServer: SocketServer
    lateinit var metrics: Metrics

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
    lateinit var contactStore: ContactStore
    lateinit var protocolStore: ProtocolStore

    private lateinit var dataSource: HikariDataSource
    val db by lazy {
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
                metricsTrackerFactory = PrometheusMetricsTrackerFactory()
                validate()
            }
        )


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

    private inline fun <reified T: Any>initializeSingleton(
        component: KClass<T>,
        mockAnswers: T.() -> Unit = {}
    ):  T =
        if(config.mocked.contains(component)) mockk(block = mockAnswers)
        else component.objectInstance!!

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

        val version = System.getenv("SIGNALC_COMMIT_HASH") ?: "unknown"
        logger.info("Booting version: $version...")
        logger.debug("...debug mode active.")

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
        accountStore = initializeColdComponent(AccountStore::class, Mocks.accountStore)
        contactStore = initializeColdComponent(ContactStore::class, Mocks.contactStore)
        protocolStore = initializeColdComponent(ProtocolStore::class, Mocks.protocolStore)

        // network resources
        signal = initializeSignal()

        // "cold" components
        accountManager = initializeColdComponent(AccountManager::class, Mocks.accountManager)
        signalReceiver = initializeColdComponent(SignalReceiver::class, Mocks.signalReceiver)
        signalSender = initializeColdComponent(SignalSender::class, Mocks.signalSender)
        socketReceiver = initializeColdComponent(SocketReceiver::class, Mocks.socketReceiver)
        socketSender = initializeColdComponent(SocketSender::class, Mocks.socketSender)
        metrics = initializeSingleton(Metrics::class, Mocks.metrics)

        // "hot" components
        socketServer = initializeHotComponent(SocketServer::class, Mocks.socketServer).run()

        // handle SIGTERM gracefully
        Runtime.getRuntime().addShutdownHook(Thread {
            runBlocking {
                this@Application.stop()
            }
        })

        logger.info("...Running!")
        return this
    }

    suspend fun stop(): Application {
        isShuttingDown = true
        logger.info { "<@3<@3<@3<@3<@3<@3<@3<@3"}
        logger.info { "Stopping application..."}

        // first stop the flow of incoming messages from signal...
        // (which will in turn stop new messages from signalboost and thus freeze our outgoing send queue)
        logger.info { "Unsubscribing from messages..."}
        signalReceiver.unsubscribeAll()
        logger.info { "... Unsubscribed from messages."}

        // then drain the receive and send queues...
        val receiveDrainJob = coroutineScope.launch {
            logger.info { "Draining RECEIVE queue..."}
            signalReceiver.drain().let { (didDrain, numToDrain, numDropped) ->
                if(didDrain) logger.info { "...Drained $numToDrain messages from RECEIVE queue."}
                else logger.error { "...Failed to drain $numToDrain messages from RECEIVE queue. $numDropped messages dropped."}
            }
        }

        val sendDrainJob = coroutineScope.launch {
            logger.info { "Draining SEND queue..."}
            signalSender.drain().let { (didDrain, numToDrain, numDropped) ->
                if(didDrain) logger.info { "...Drained $numToDrain messages from SEND queue."}
                else logger.error { "...Failed to drain $numToDrain messages from SEND queue. $numDropped messages dropped."}
            }
        }

        listOf(receiveDrainJob, sendDrainJob).joinAll()

        // then shutdown all resources...
        socketServer.stop()
        dataSource.closeQuietly()
        logger.info { "...application stopped!"}
        logger.info { "<@3<@3<@3<@3<@3<@3<@3<@3"}

        return this
    }

    fun exit(status: Int): Unit = Exit.withStatus(status)

    object Exit {
        // testing seam
        fun withStatus(status: Int)  {
            exitProcess(status)
        }
    }
}


