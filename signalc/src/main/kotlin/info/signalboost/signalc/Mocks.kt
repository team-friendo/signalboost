package info.signalboost.signalc

import com.zaxxer.hikari.HikariDataSource
import info.signalboost.signalc.logic.*
import info.signalboost.signalc.store.EnvelopeStore
import info.signalboost.signalc.store.ProtocolStore
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
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
        coEvery { load(any()) } returns mockk()
        coEvery { register(any(), any()) } returns mockk()
        coEvery { verify(any(), any()) } returns mockk()
        coEvery { publishPreKeys(any()) } returns mockk()
    }
    val dataSource: HikariDataSource.() -> Unit = {
        every { closeQuietly() } returns Unit
    }
    val envelopeStore: EnvelopeStore.() -> Unit = {
        every { create(any(), any()) } returns mockk()
        coEvery { delete(any()) } returns Unit
        coEvery { findAll(any()) } returns emptyList()
    }
    val protocolStore: ProtocolStore.() -> Unit = {
        every { of(any()) } returns mockk {
            every { saveIdentity(any(), any()) } returns mockk()
        }
    }
    val signalReceiver: SignalReceiver.() -> Unit = {
        coEvery { subscribe(any()) } returns mockk()
        coEvery { unsubscribe(any()) } returns mockk()
        coEvery { unsubscribeAll() } returns mockk()
    }
    val signalSender: SignalSender.() -> Unit = {
        coEvery { send(any(), any(), any(), any(), any(), any()) } returns mockk {
            every { success } returns mockk()
        }
        coEvery { setExpiration(any(), any(), any()) } returns mockk {
            every { success } returns mockk()
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
}