package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.Application
import info.signalboost.signalc.util.FileUtil.readToFile
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import java.io.File
import java.io.InputStream
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalPathApi
object FileGen {
    fun genJpegInputStream(): InputStream = {}::class.java.getResourceAsStream(
    "tiny-pink-square.jpg"
    )!!

    fun genJpegFile(file: File): File = genJpegInputStream().use {
        readToFile(it, file)!!
    }

    fun deleteAllAttachments(app: Application): Unit = File(app.signal.attachmentsPath)
        .walk()
        .forEach {
            if(!it.name.contains("attachments")) it.delete()
        }
}