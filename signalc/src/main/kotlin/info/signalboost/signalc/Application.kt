package info.signalboost.signalc

import info.signalboost.signalc.logic.*
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.ProtocolStore
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.*
import mu.KLogging
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
import java.io.*
import java.security.Security
import kotlin.reflect.KClass
import kotlin.reflect.full.primaryConstructor
import kotlin.system.exitProcess
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class Application(val config: Config.App){
    companion object: KLogging()
    init {
        Security.addProvider(BouncyCastleProvider())
        System.setProperty(
            IO_PARALLELISM_PROPERTY_NAME,
            "${Runtime.getRuntime().availableProcessors() * config.threads.perProcessor}"
        )
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
        val certificateValidator: CertificateValidator,
        val clientZkOperations: ClientZkOperations?,
        val configs: SignalServiceConfiguration,
        val groupsV2Operations: GroupsV2Operations?,
        val trustStore: TrustStore,
    )

    lateinit var signal: Signal

    private fun initializeSignal(): Signal = Signal(
        agent = config.signal.agent,
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
            )
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
            mutableListOf(),
            Optional.absent(),
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
    lateinit var protocolStore: ProtocolStore

    private val db by lazy {
        Database.connect(
            driver = config.db.driver,
            url = config.db.url,
            user = config.db.user,
        )
    }

    /**************
     * LIFECYCLE
     *************/

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

        // concurrency context:
        coroutineScope = scope + SupervisorJob()
        /*** NOTE:
         * we declare a supervisor job so that failure of a child coroutine won't cause the
         * app's parent job (and thus all other child coroutines in the app) to be cancelled.
         * see: https://kotlinlang.org/docs/exception-handling.html#supervision-job
         ***/


        // storage resources
        accountStore = initializeStore(AccountStore::class)
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

        logger.info("...Running!")
        return this
    }


    suspend fun stop(withPanic: Boolean = false): Application {
        socketServer.stop()
        // TODO: close db connection?
        if(withPanic) exitProcess(1)
        return this
    }

    // INITIALIZERS

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

    // MOCKS

    object Mocks {
        val accountManager: AccountManager.() -> Unit = {
            coEvery { load(any()) } returns mockk()
            coEvery { register(any(),any()) } returns mockk()
            coEvery { verify(any(),any()) } returns mockk()
            coEvery { publishPreKeys(any()) } returns mockk()
        }
        val protocolStore: ProtocolStore.() -> Unit = {
            every { of(any()) } returns mockk()
        }
        val signalReceiver: SignalReceiver.() -> Unit = {
            coEvery { subscribe(any()) } returns mockk()
        }
        val signalSender: SignalSender.() -> Unit = {
            coEvery { send(any(),any(),any(),any(),any()) } returns mockk {
                every { success } returns  mockk()
            }
        }
        val socketReceiver: SocketReceiver.() -> Unit = {
            coEvery { connect(any()) } returns mockk()
            coEvery { close(any()) } returns mockk()
            coEvery { stop() } returns mockk()
        }
        val socketSender: SocketSender.() -> Unit = {
            coEvery { connect(any()) } returns mockk()
            coEvery { close(any()) } returns mockk()
            coEvery { stop() } returns mockk()
            coEvery { send(any()) } returns mockk()
        }
        val socketServer: SocketServer.() -> Unit = {
            coEvery { run() } returns mockk() {
                coEvery { stop() } returns Unit
                coEvery { close(any()) } returns Unit
            }
        }
    }
}


