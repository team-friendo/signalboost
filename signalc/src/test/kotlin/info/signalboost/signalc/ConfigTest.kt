package info.signalboost.signalc

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beOfType

class ConfigTest : FreeSpec({
    val defaultYaml = """
      db:
        url: "jdbc:pgsql://localhost:5432/signalc"
        user: "postgres"
        driver: "com.impossibl.postgres.jdbc.PGDriver"
      signal:
        agent: "signalc"
        addSecurityProvider: true
        trustStorePath: "/signalc/whisper.store"
        trustStorePassword: "whisper"
        zkGroupServerPublicParams:  "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0="
        serviceUrl:  "https://textsecure-service.whispersystems.org"
        cdnUrl:  "https://cdn.signal.org"
        cdn2Url:  "https://cdn2.signal.org"
        contactDiscoveryUrl:  "https://cms.souqcdn.com"
        keyBackupServiceUrl:  "https://api.backup.signal.org"
        storageUrl:  "https://storage.signal.org"
      store:
        account: 'SQL'
        signalProtocol: 'SQL'  
    """.trimIndent()

    val defaultConfigs = Config.App(
        db = Config.Database(
            driver = "com.impossibl.postgres.jdbc.PGDriver",
            url = "jdbc:pgsql://localhost:5432/signalc",
            user= "postgres"
        ),
        signal= Config.Signal(
            addSecurityProvider = true,
            agent = "signalc",
            trustStorePath = "/signalc/whisper.store",
            trustStorePassword="whisper",
            zkGroupServerPublicParams= "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0=",
            serviceUrl= "https://textsecure-service.whispersystems.org",
            cdnUrl= "https://cdn.signal.org",
            cdn2Url="https://cdn2.signal.org",
            contactDiscoveryUrl="https://cms.souqcdn.com",
            keyBackupServiceUrl="https://api.backup.signal.org",
            storageUrl="https://storage.signal.org",
        ),
        store= Config.Store(
            account = Config.StoreType.SQL,
            signalProtocol = Config.StoreType.SQL,
        ),
    )

    val testYaml = """
      db:
        url: "jdbc:pgsql://localhost:5432/signalc_test"
      store:
        account: 'MOCK'
        signalProtocol: 'MOCK'  
    """.trimIndent()

    val testConfigs = defaultConfigs.copy(
        db = defaultConfigs.db.copy(
            url = "jdbc:pgsql://localhost:5432/signalc_test"
        ),
        store = Config.Store(
            account = Config.StoreType.MOCK,
            signalProtocol = Config.StoreType.MOCK,
        )
    )

    "parses configs from env" {
        Config.prod should beOfType<Config.App>()
        Config.dev should beOfType<Config.App>()
        Config.test should beOfType<Config.App>()
        Config.fromEnv(Config.Env.Dev) shouldBe Config.dev
        Config.fromEnvs(listOf(Config.Env.Default, Config.Env.Dev)) shouldBe Config.dev
    }

    "parses configs from one yaml file" {
        Config.fromYamls(listOf(defaultYaml)) shouldBe defaultConfigs
    }

    "parses configs from many cascading yaml files" {
        Config.fromYamls(listOf(defaultYaml, testYaml)) shouldBe testConfigs
    }

})
