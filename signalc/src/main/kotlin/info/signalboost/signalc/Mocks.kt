package info.signalboost.signalc

import com.zaxxer.hikari.HikariDataSource
import info.signalboost.signalc.logic.*
import info.signalboost.signalc.metrics.Metrics
import info.signalboost.signalc.model.SignalcAddress
import info.signalboost.signalc.model.SignalcSendResult
import info.signalboost.signalc.store.ProfileStore
import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.ProtocolStore
import info.signalboost.signalc.util.DatabaseUtil
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import okhttp3.internal.closeQuietly
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalPathApi
object Mocks {
    val accountManager: AccountManager.() -> Unit = {
        coEvery { deleteAccountFromSignal(any()) } returns mockk()
        coEvery { deleteAccountFromDatabase(any()) } returns mockk()
        coEvery { load(any()) } returns mockk()
        coEvery { register(any(), any()) } returns mockk()
        coEvery { verify(any(), any()) } returns mockk()
        coEvery { publishPreKeys(any()) } returns Unit
        coEvery { publishPreKeys(any(), any()) } returns Unit
        coEvery { refreshPreKeysIfDepleted(any()) } returns Unit
        coEvery { getUnidentifiedAccessPair(any(), any()) } returns mockk()
    }
    val accountStore: AccountStore.() -> Unit = {
        coEvery { delete(any()) } returns mockk()
    }
    val databaseUtil: DatabaseUtil.() -> Unit = {
        every { vacuumDatabase() } returns mockk()
    }
    val dataSource: HikariDataSource.() -> Unit = {
        every { closeQuietly() } returns Unit
        every { connection } returns mockk {
            every { autoCommit } returns false
        }
    }
    val profileStore: ProfileStore.() -> Unit = {
        coEvery { storeProfileKey(any(), any(), any())} returns Unit
        coEvery { loadProfileKey(any(), any())} returns mockk()
    }
    val protocolStore: ProtocolStore.() -> Unit = {
        every { of(any()) } returns mockk {
            every { lock } returns mockk()
            every { deleteAllRecordsOfAccount() } returns mockk()
            every { saveIdentity(any(), any()) } returns mockk()
            every { archiveAllSessions(any()) } returns Unit
            coEvery { getLastPreKeyId() } returns 0
            coEvery { getLastSignedPreKeyId() } returns 0
            coEvery { storePreKeys(any()) } returns Unit
        }
    }
    val signalReceiver: SignalReceiver.() -> Unit = {
        coEvery { subscribe(any()) } returns mockk()
        coEvery { unsubscribe(any()) } returns mockk()
        coEvery { unsubscribeAll() } returns mockk()
        coEvery { drain() } returns Triple(true,0,0)
    }
    val signalSender: SignalSender.() -> Unit = {
        fun mockkSuccessOf(recipientAddress: SignalcAddress) =
            mockk<SignalcSendResult.Success> {
                every { address } returns recipientAddress
                every { duration } returns 0L
                every { isUnidentified } returns false
                every { isNeedsSync } returns true
            }
        coEvery { send(any(), any(), any(), any(), any(), any()) } answers {
            mockkSuccessOf(secondArg())
        }
        coEvery { setExpiration(any(), any(), any()) } answers {
            mockkSuccessOf(secondArg())
        }
        coEvery { drain() } returns Triple(true,0,0)
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
    val metrics: Metrics.() -> Unit = {
        mockkObject(Metrics.AccountManager)
        mockkObject(Metrics.LibSignal)
        mockkObject(Metrics.SignalSender)
        mockkObject(Metrics.SignalReceiver)
        mockkObject(Metrics.SocketSender)
    }
}