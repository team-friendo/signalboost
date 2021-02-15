package info.signalboost.signalc.model

import kotlinx.serialization.Serializable

@Serializable
data class SocketAddress(
    val number: String?,
    val uuid: String?,
)