import org.gradle.kotlin.dsl.*
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

group = "info.signalboost"
version = "0.0.3"
val entrypoint = "info.signalboost.signalc.MainKt"

repositories {
    mavenCentral()
    jcenter()
}

plugins {
    application
    java
    kotlin("jvm") version "1.4.21"
    kotlin("plugin.serialization") version "1.4.10"
    id("com.github.johnrengelman.shadow") version "5.2.0"
}

application {
    mainClass.set(entrypoint)
    mainClassName = entrypoint
}

tasks.withType<KotlinCompile> {
    kotlinOptions.jvmTarget = JavaVersion.VERSION_11.toString()
}

tasks.withType<Jar> {
    manifest {
        attributes["Main-Class"] = application.mainClass
    }
}

tasks.withType<JavaExec>{
    run {
        standardInput = System.`in`
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
    const val coroutines = "1.4.2"
    const val exposed = "0.25.1"
    const val jsonSerialization = "1.0.1"
    const val kaml = "0.26.0"
    const val kotest = "4.3.1"
    const val kotlin = "1.4.21"
    const val h2 = "1.4.199"
    const val libsignal = "2.15.3_unofficial_14"
    const val mockk = "1.10.3"
    const val pgjdbc = "0.8.3"
    const val shadowJar = "5.2.0"
    const val slf4j = "1.7.30"
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:${Versions.coroutines}")
    implementation("org.jetbrains.kotlin:kotlin-reflect:${Versions.kotlin}")
    implementation("com.github.turasa:signal-service-java:${Versions.libsignal}")
    implementation("org.bouncycastle:bcprov-jdk15on:${Versions.bouncyCastle}")
    implementation("org.jetbrains.exposed:exposed-core:${Versions.exposed}")
    implementation("org.jetbrains.exposed:exposed-jdbc:${Versions.exposed}")
    implementation("com.h2database:h2:${Versions.h2}")
    implementation("com.impossibl.pgjdbc-ng:pgjdbc-ng:${Versions.pgjdbc}")
    implementation("org.slf4j:slf4j-nop:${Versions.slf4j}")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:${Versions.jsonSerialization}")

    implementation("io.mockk:mockk:${Versions.mockk}")
    testImplementation("io.kotest:kotest-runner-junit5:${Versions.kotest}")
    testImplementation("io.kotest:kotest-assertions-core:${Versions.kotest}")
    testImplementation("io.kotest:kotest-property:${Versions.kotest}")
}