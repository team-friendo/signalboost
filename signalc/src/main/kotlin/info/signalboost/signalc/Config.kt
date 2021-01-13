package info.signalboost.signalc

object Config {
    const val USER_PHONE_NUMBER = "+17347962920"

    enum class StoreType {
        SQL,
        MOCK,
    }

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
        val mockAdapters: Boolean,
    )

    data class Store(
        val account: StoreType,
        val signalProtocol: StoreType,
    )

    private val default = App(
        Database(
            driver = "com.impossibl.postgres.jdbc.PGDriver",
            url = "jdbc:pgsql://localhost:5432/signalc",
            user = "postgres",
        ),
        Signal(
            addSecurityProvider = true,
            agent = "signalc",
            trustStorePath = "/signalc/whisper.store",
            trustStorePassword = "whisper",
            zkGroupServerPublicParams = "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0=",
            serviceUrl = "https://textsecure-service.whispersystems.org",
            cdnUrl = "https://cdn.signal.org",
            cdn2Url = "https://cdn2.signal.org",
            contactDiscoveryUrl = "https://cms.souqcdn.com",
            keyBackupServiceUrl = "https://api.backup.signal.org",
            storageUrl = "https://storage.signal.org",
            mockAdapters = false,
        ),
        Store(
            account = StoreType.SQL,
            signalProtocol = StoreType.SQL,
        )
    )

    val dev = default.copy(
        db = default.db.copy(
            url = "jdbc:pgsql://localhost:5432/signalc_development",
        )
    )

    val test = default.copy(
        db = default.db.copy(
            url = "jdbc:pgsql://localhost:5432/signalc_test",
        ),
        signal = default.signal.copy(
            mockAdapters = true,
            trustStorePath = "/signalc/whisper.store",
        ),
        store = Store(
            account = StoreType.MOCK,
            signalProtocol = StoreType.MOCK,
        )
    )
}