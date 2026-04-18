package service

import io.github.cymoo.colleen.FilePart
import model.FileInfo
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.*
import javax.imageio.ImageIO

/**
 * File management service for uploaded images and files.
 *
 * @param uploadDir  Local directory for storing uploads.
 * @param maxImageSize  Maximum allowed image size in bytes.
 * @param maxFileSize   Maximum allowed file size in bytes.
 */
class FileService(
    uploadDir: String,
    private val maxImageSize: Long = 5L * 1024 * 1024,
    private val maxFileSize: Long = 20L * 1024 * 1024
) {

    private val uploadPath: Path = Paths.get(uploadDir)

    init {
        Files.createDirectories(uploadPath)
    }

    fun saveImage(file: FilePart): FileInfo {
        validateImageSize(file.size)
        validateImageType(file.contentType)

        val safeFilename = generateSafeFilename(file.filename)
        val targetPath = uploadPath.resolve(safeFilename)

        file.save(targetPath.toString())

        val (width, height) = readImageDimensions(targetPath.toFile())

        return FileInfo(
            fileName = safeFilename,
            fileUrl = "/uploads/$safeFilename",
            fileSize = file.size,
            mimeType = file.contentType ?: "application/octet-stream",
            width = width,
            height = height
        )
    }

    fun saveFile(file: FilePart): FileInfo {
        validateFileSize(file.size)

        val safeFilename = generateSafeFilename(file.filename)
        val targetPath = uploadPath.resolve(safeFilename)

        file.save(targetPath.toString())

        return FileInfo(
            fileName = safeFilename,
            fileUrl = "/uploads/$safeFilename",
            fileSize = file.size,
            mimeType = file.contentType ?: "application/octet-stream"
        )
    }

    fun getFile(filename: String): File? {
        val safeFilename = sanitizeFilename(filename)
        val file = uploadPath.resolve(safeFilename).toFile()
        return if (file.exists() && file.isFile) file else null
    }

    private fun validateImageSize(size: Long) {
        if (size > maxImageSize) {
            throw IllegalArgumentException("Image too large. Maximum: ${maxImageSize / 1024 / 1024}MB")
        }
    }

    private fun validateImageType(contentType: String?) {
        val allowedTypes = setOf("image/jpeg", "image/png", "image/gif", "image/webp")
        if (contentType !in allowedTypes) {
            throw IllegalArgumentException("Invalid image type. Allowed: JPEG, PNG, GIF, WebP")
        }
    }

    private fun validateFileSize(size: Long) {
        if (size > maxFileSize) {
            throw IllegalArgumentException("File too large. Maximum: ${maxFileSize / 1024 / 1024}MB")
        }
    }

    private fun generateSafeFilename(originalFilename: String): String {
        val timestamp = System.currentTimeMillis()
        val uuid = UUID.randomUUID().toString().substring(0, 8)
        val extension = originalFilename.substringAfterLast('.', "")
        val sanitizedName = sanitizeFilename(originalFilename.substringBeforeLast('.'))

        return if (extension.isNotEmpty()) {
            "${timestamp}_${uuid}_${sanitizedName}.${extension}"
        } else {
            "${timestamp}_${uuid}_${sanitizedName}"
        }
    }

    private fun sanitizeFilename(filename: String): String {
        return filename
            .replace('/', '_')
            .replace('\\', '_')
            .replace(Regex("[^a-zA-Z0-9._-]"), "_")
            .take(100) // Limit filename length
    }

    /**
     * Read image dimensions using ImageIO without fully decoding pixel data.
     * Returns (width, height) or (null, null) if dimensions cannot be determined.
     */
    private fun readImageDimensions(file: File): Pair<Int?, Int?> {
        return try {
            val stream = ImageIO.createImageInputStream(file) ?: return Pair(null, null)
            stream.use { input ->
                val readers = ImageIO.getImageReaders(input)
                if (!readers.hasNext()) return Pair(null, null)
                val reader = readers.next()
                try {
                    reader.input = input
                    Pair(reader.getWidth(0), reader.getHeight(0))
                } finally {
                    reader.dispose()
                }
            }
        } catch (_: Exception) {
            Pair(null, null)
        }
    }
}