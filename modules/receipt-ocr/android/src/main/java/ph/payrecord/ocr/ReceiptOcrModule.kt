package ph.paytsek.ocr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

/**
 * On-device OCR (ML Kit Text Recognition v2, bundled Latin model) and
 * metadata stripping. Nothing leaves the device from this module.
 */
class ReceiptOcrModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

  override fun definition() = ModuleDefinition {
    Name("ReceiptOcr")

    AsyncFunction("recognize") { fileUri: String, promise: Promise ->
      try {
        val uri = Uri.parse(fileUri)
        val image = InputImage.fromFilePath(context, uri)
        recognizer.process(image)
          .addOnSuccessListener { text ->
            val w = image.width.toFloat().coerceAtLeast(1f)
            val h = image.height.toFloat().coerceAtLeast(1f)
            val blocks = text.textBlocks.flatMap { b -> b.lines }.map { line ->
              val box = line.boundingBox
              mapOf(
                "text" to line.text,
                "confidence" to (line.confidence.takeIf { !it.isNaN() }),
                "box" to (box?.let { listOf(it.left / w, it.top / h, it.width() / w, it.height() / h) }),
              )
            }
            promise.resolve(
              mapOf(
                "engine" to "MLKIT_TEXT_V2",
                "engineVersion" to "text-recognition:16.0.1",
                "fullText" to blocks.joinToString("\n") { it["text"] as String },
                "blocks" to blocks,
                "imageWidth" to image.width,
                "imageHeight" to image.height,
              ),
            )
          }
          .addOnFailureListener { e -> promise.reject("OCR_FAILED", e.message, e) }
      } catch (e: Exception) {
        promise.reject("OCR_FAILED", e.message, e)
      }
    }

    /** Decode, apply EXIF orientation, re-encode as JPEG without any metadata (drops GPS). */
    AsyncFunction("stripMetadata") { fileUri: String, quality: Double ->
      val path = Uri.parse(fileUri).path ?: throw IllegalArgumentException("bad uri")
      val exif = ExifInterface(path)
      val rotation = when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
      var bmp = BitmapFactory.decodeFile(path) ?: throw IllegalStateException("decode failed")
      if (rotation != 0f) {
        val m = Matrix().apply { postRotate(rotation) }
        bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
      }
      val out = File(context.cacheDir, "clean-${System.currentTimeMillis()}.jpg")
      FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt().coerceIn(50, 100), it) }
      mapOf("uri" to Uri.fromFile(out).toString(), "byteLength" to out.length().toInt(), "contentType" to "image/jpeg")
    }

    /** Android receives shared images through the SEND intent handled in JS; nothing staged here. */
    AsyncFunction("drainSharedInbox") { emptyList<Map<String, Any>>() }
  }
}
