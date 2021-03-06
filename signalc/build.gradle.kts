import org.gradle.kotlin.dsl.*
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile
import java.net.URI

group = "info.signalboost"
version = "0.0.3"
val entrypoint = "info.signalboost.signalc.MainKt"

repositories {
    // note: to modify a local version of libsignal-service-java and use it in a signalc container,
    // uncomment mavenLocal() and mount the local maven directory (~/.m2) as a volume into the container
    // mavenLocal()
    maven {
        url = URI("https://0xacab.org/api/v4/projects/1563/packages/maven")
    }
    mavenCentral()
    jcenter()
}

plugins {
    application
    java
    kotlin("jvm") version "1.5.10"
    kotlin("plugin.serialization") version "1.5.10"
    id("com.github.johnrengelman.shadow") version "5.2.0"
    id("org.liquibase.gradle") version "2.0.4"
}

application {
    mainClass.set(entrypoint)
    mainClassName = entrypoint
    applicationDefaultJvmArgs = listOf("-Dkotlinx.coroutines.debug")

}

tasks.withType<KotlinCompile> {
    kotlinOptions.jvmTarget = JavaVersion.VERSION_11.toString()
}

tasks.withType<Jar> {
    val commitHash = System.getenv("COMMIT_HASH") ?: run {
        println("WARNING no value provided for for COMMIT_HASH")
        "NO_VERSION"
    }
    archiveFileName.set("signalc-$commitHash.jar")
    manifest {
        attributes["Main-Class"] = application.mainClass
    }
}

tasks.withType<JavaExec>{
    run {
        standardInput = System.`in`
        if (System.getenv("DEBUG_MODE") == "1") {
            environment(
                "JAVA_TOOL_OPTIONS" to "-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=0.0.0.0:5005"
            )
        }
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.withType<Wrapper> {
    gradleVersion = "6.7.1"
}

object Versions {
    const val bouncyCastle = "1.66"
    const val coroutines = "1.5.0"
    const val exposed = "0.31.1"
    const val googleProtobuf = "3.10.0"
    const val kaml = "0.26.0"
    const val kotest = "4.6.0"
    const val kotlin = "1.5.10"
    const val kotlinSerialization = "1.2.1"
    const val h2 = "1.4.199"
    const val hikariCp = "4.0.3"
    const val libsignal = "2.15.3_unofficial_t23_m1"
    const val liquibase = "4.2.2"
    const val liquibasePlugin = "2.0.4"
    const val logback = "1.2.3"
    const val log4j = "2.14.0"
    const val logging = "2.0.2"
    const val mockk = "1.10.6"
    const val postgres = "42.2.18"
    const val shadowJar = "5.2.0"
    const val slf4j = "1.7.30"
    const val junixSocket = "2.3.2"
}

configurations {
    // Necessary to avoid "muliple binding" errors from sl4j when it tries to provide a default
    // logger when none is present. See: http://www.slf4j.org/codes.html#multiple_bindings
    all {
        exclude(group = "org.slf4j", module = "slf4j-nop")
    }
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:${Versions.coroutines}")
    implementation("org.jetbrains.kotlin:kotlin-reflect:${Versions.kotlin}")
    implementation("info.signalboost:libsignal-service:${Versions.libsignal}")
    implementation("org.bouncycastle:bcprov-jdk15on:${Versions.bouncyCastle}")
    implementation("org.jetbrains.exposed:exposed-core:${Versions.exposed}")
    implementation("org.jetbrains.exposed:exposed-jdbc:${Versions.exposed}")
    implementation("org.jetbrains.exposed:exposed-java-time:${Versions.exposed}")
    implementation("com.h2database:h2:${Versions.h2}")
    implementation("org.slf4j:slf4j-nop:${Versions.slf4j}")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:${Versions.kotlinSerialization}")
    implementation("com.kohlschutter.junixsocket:junixsocket-core:${Versions.junixSocket}")
    implementation("com.zaxxer:HikariCP:${Versions.hikariCp}")
    implementation("com.google.protobuf:protobuf-javalite:${Versions.googleProtobuf}")
    // Note: `kotlin-logback` wraps sl4j, which is an abstract facade that needs a concrete impl...
    implementation ("io.github.microutils:kotlin-logging-jvm:${Versions.logging}")
    // Logback is our current choice b/c (1) easier to configure, (2) https://www.marcobehler.com/guides/java-logging
    // Log4j2 is benched b/c harder to configure, but might be better according to : https://medium.com/@arunmannuru/java-logging-frameworks-ad07e0602de3
    implementation("ch.qos.logback:logback-classic:${Versions.logback}")
    implementation("io.prometheus:simpleclient:0.9.0")
    implementation("io.prometheus:simpleclient_hotspot:0.9.0")
    implementation("io.prometheus:simpleclient_httpserver:0.9.0")

    // migrations
    implementation("org.liquibase:liquibase-core:${Versions.liquibase}")
    implementation("org.liquibase:liquibase-gradle-plugin:${Versions.liquibasePlugin}")
    implementation("org.postgresql:postgresql:${Versions.postgres}")
    add("liquibaseRuntime", "org.liquibase:liquibase-core:${Versions.liquibase}")
    add("liquibaseRuntime", "org.liquibase:liquibase-gradle-plugin:${Versions.liquibasePlugin}")
    add("liquibaseRuntime", "org.postgresql:postgresql:42.2.5")

    // yes, we declare mocck as `implementation` not `testImplementation` on purpose! (see Application.kt)
    implementation("io.mockk:mockk:${Versions.mockk}")

    testImplementation("io.kotest:kotest-runner-junit5:${Versions.kotest}")
    testImplementation("io.kotest:kotest-assertions-core:${Versions.kotest}")
    testImplementation("io.kotest:kotest-property:${Versions.kotest}")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:${Versions.coroutines}")
}

liquibase {
    val dbHost = System.getenv("DB_HOST") ?: "localhost:5432"
    val dbName = System.getenv("SIGNALC_DB_NAME")
        ?: when(System.getenv("SIGNALC_ENV")) {
            "development" -> "signalc_development"
            "test" -> "signalc_test"
            "load" -> "loadtest_sender_signalc"
            else -> "signalc"
        }
    activities.register("main") {
        this.arguments = mapOf(
//            "logLevel" to "info",
            "changeLogFile" to "migrations/changelog.postgresql.sql",
            "url" to "jdbc:postgresql://${dbHost}/${dbName}",
            "username" to "postgres"
        )
    }
    runList = "main"
}
