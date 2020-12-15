import org.gradle.kotlin.dsl.*
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

group = "info.signalboost"
version = "0.0.3"
val entrypoint = "info.signalboost.signalc.MainKt"


repositories {
    mavenCentral()
}

plugins {
    application
    java
    kotlin("jvm") version "1.4.10"
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
    val bouncyCastle = "1.66"
    val coroutines = "1.3.9"
    val kotest = "4.3.1"
    val libsignal = "2.15.3_unofficial_14"
    val mockk = "1.10.3"
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:${Versions.coroutines}")
    implementation("com.github.turasa:signal-service-java:${Versions.libsignal}")
    implementation("org.bouncycastle:bcprov-jdk15on:${Versions.bouncyCastle}")

    testImplementation("io.kotest:kotest-runner-junit5:${Versions.kotest}")
    testImplementation("io.kotest:kotest-assertions-core:${Versions.kotest}")
    testImplementation("io.kotest:kotest-property:${Versions.kotest}")
    testImplementation("io.mockk:mockk:${Versions.mockk}")
}