package info.signalboost.signalc.util

import mu.KLoggable
import java.io.File
import java.nio.file.Files
import java.io.IOException
import java.io.InputStream
import kotlin.io.path.ExperimentalPathApi

@ExperimentalPathApi
object FileUtil: KLoggable {
    override val logger = logger()

    fun readToFile(inputStream: InputStream, outputFile: File): File? {
        try {
            val buffer = ByteArray(4096)
            inputStream.use { input ->
                Files.newOutputStream(outputFile.toPath()).use { output ->
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        output.write(buffer, 0, read)
                    }
                }
            }
        } catch (e: IOException) {
            logger.error { "Failed to read input stream to ${outputFile.name}:\n${e.stackTraceToString()}" }
            return null
        }
        return outputFile
    }

}