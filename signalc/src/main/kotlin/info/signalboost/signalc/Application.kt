package info.signalboost.signalc

import info.signalboost.signalc.logic.*
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.ProtocolStore
import info.signalboost.signalc.util.UnixServerSocket
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jetbrains.exposed.sql.Database
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.groupsv2.ClientZkOperations
import org.whispersystems.signalservice.api.groupsv2.GroupsV2Operations
import org.whispersystems.signalservice.api.push.TrustStore
import org.whispersystems.signalservice.internal.configuration.*
import org.whispersystems.util.Base64
import java.security.Security

import org.signal.libsignal.metadata.certificate.CertificateValidator
import org.whispersystems.libsignal.ecc.Curve
import org.whispersystems.signalservice.api.messages.SendMessageResult
import java.io.*
import kotlin.reflect.KClass
import kotlin.reflect.full.primaryConstructor
import kotlin.system.exitProcess
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class Application(val config: Config.App) {
    init {
        if (config.signal.addSecurityProvider) {
            Security.addProvider(BouncyCastleProvider())
        }
    }

    /**************
     * COMPONENTS
     *************/

    lateinit var accountManager: AccountManager
    lateinit var signalMessageSender: SignalMessageSender
    lateinit var signalMessageReceiver: SignalMessageReceiver
    lateinit var socketMessageReceiver: SocketMessageReceiver
    lateinit var socketMessageSender: SocketMessageSender
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
            override fun getKeyStoreInputStream(): InputStream = FileInputStream(config.signal.trustStorePath)
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

    // SOCKET //

    lateinit var socket: UnixServerSocket

    private fun initializeSocket(): UnixServerSocket =
        if(config.mocked.contains(UnixServerSocket::class)) mockk() {
            every { isClosed } returns false
            every { close() } returns Unit
        }
        else AFUNIXServerSocket.newInstance().apply {
            bind(AFUNIXSocketAddress(File(config.socket.path)))
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

    // Generic Component intializers
    interface ReturningRunnable<T> {
        suspend fun run(): T
    }

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


    private inline fun <reified U: Any, reified T: ReturningRunnable<U>>initializeHotComponent(
        component: KClass<T>,
        mockAnswers: T.() -> Unit = { coEvery { run() } returns mockk() }
    ): T =
        if(config.mocked.contains(component)) mockk(block = mockAnswers)
        else (component.primaryConstructor!!::call)(arrayOf(this@Application))


    @ExperimentalCoroutinesApi
    suspend fun run(scope: CoroutineScope): Application {

        // concurrency context
        coroutineScope = scope

        // storage resources
        accountStore = initializeStore(AccountStore::class)
        protocolStore = initializeStore(ProtocolStore::class){
            every { of(any()) } returns mockk()
        }

        // network resources
        socket = initializeSocket()
        signal = initializeSignal()

        // "cold" components
        accountManager = initializeColdComponent(AccountManager::class)
        signalMessageReceiver = initializeColdComponent(SignalMessageReceiver::class){
            coEvery { subscribe(any()) } returns mockk()
        }
        signalMessageSender = initializeColdComponent(SignalMessageSender::class){
            coEvery { send(any(),any(),any(),any(),any()) } returns mockk() {
                every { success } returns  mockk()
            }
        }
        socketMessageReceiver = initializeColdComponent(SocketMessageReceiver::class) {
            coEvery { connect(any()) } returns mockk()
            coEvery { disconnect(any()) } returns mockk()
            coEvery { stop() } returns mockk()
        }
        socketMessageSender = initializeColdComponent(SocketMessageSender::class){
            coEvery { connect(any()) } returns mockk()
            coEvery { disconnect(any()) } returns mockk()
            coEvery { stop() } returns mockk()
            coEvery { send(any()) } returns mockk()
        }

        // "hot" components
        socketServer = initializeHotComponent(SocketServer::class) {
            coEvery { run() } returns mockk() {
                coEvery { stop() } returns Unit
                coEvery { disconnect(any()) } returns Unit
            }
        }.run()
        println("running!\nlistening for connections at ${config.socket.path}...")

        return this
    }


    suspend fun stop(withPanic: Boolean = false): Application {
        socketServer.stop()
        coroutineScope.async(IO) { socket.close() }.await()
        // TODO: close db connection?
        if(withPanic) exitProcess(1)
        return this
    }
}


