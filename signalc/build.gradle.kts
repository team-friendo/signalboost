plugins {
    java
    kotlin("jvm") version "1.4.10"
}

group = "info.signalboost"
version = "0.0.2"

repositories {
    mavenCentral()
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions.suppressWarnings = true
    kotlinOptions.jvmTarget = JavaVersion.VERSION_11.toString()
}

object Versions {
    val bouncyCastle = "1.66"
    val coroutines = "1.3.9"
    val libsignal = "2.15.3_unofficial_14"
    val kotest = "4.3.1"
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:${Versions.coroutines}")
    implementation("com.github.turasa:signal-service-java:${Versions.libsignal}")
    implementation("org.bouncycastle:bcprov-jdk15on:${Versions.bouncyCastle}")
    testImplementation("io.kotest:kotest-runner-junit5:${Versions.kotest}")
    testImplementation("io.kotest:kotest-assertions-core:${Versions.kotest}")
    testImplementation("io.kotest:kotest-property:${Versions.kotest}")
}
