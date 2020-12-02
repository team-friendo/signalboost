plugins {
    java
    kotlin("jvm") version "1.4.10"
}

group = "info.signalboost"
version = "0.0.2"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.3.9")
    implementation("com.github.turasa:signal-service-java:2.15.3_unofficial_14")
    implementation("org.bouncycastle:bcprov-jdk15on:1.66")
    testImplementation("junit", "junit", "4.12")
}
