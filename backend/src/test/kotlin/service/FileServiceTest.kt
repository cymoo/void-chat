package service

import io.github.cymoo.colleen.FilePart
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.ByteArrayInputStream
import java.nio.file.Files
import java.nio.file.Path

class FileServiceTest {

    private lateinit var fileService: FileService

    @TempDir
    lateinit var tempDir: Path

    @BeforeEach
    fun setUp() {
        fileService = FileService(
            uploadDir = tempDir.toString(),
            maxImageSize = 1024 * 10,   // 10KB for tests
            maxFileSize = 1024 * 50     // 50KB for tests
        )
    }

    private fun filePart(name: String, contentType: String, data: ByteArray): FilePart =
        FilePart(name, name, contentType, data.size.toLong(), ByteArrayInputStream(data))

    @Test
    fun `saveImage stores file and returns info`() {
        val data = ByteArray(500)
        val part = filePart("photo.jpg", "image/jpeg", data)
        val info = fileService.saveImage(part)

        assertTrue(info.fileUrl.startsWith("/uploads/"))
        assertTrue(info.fileUrl.endsWith(".jpg"))
        assertEquals("image/jpeg", info.mimeType)
    }

    @Test
    fun `saveImage rejects oversized image`() {
        val data = ByteArray(1024 * 20) // 20KB > 10KB limit
        val part = filePart("big.jpg", "image/jpeg", data)
        assertThrows(IllegalArgumentException::class.java) {
            fileService.saveImage(part)
        }
    }

    @Test
    fun `saveImage rejects non-image content type`() {
        val data = ByteArray(100)
        val part = filePart("fake.txt", "text/plain", data)
        assertThrows(IllegalArgumentException::class.java) {
            fileService.saveImage(part)
        }
    }

    @Test
    fun `saveFile stores file and returns info`() {
        val data = ByteArray(200)
        val part = filePart("report.pdf", "application/pdf", data)
        val info = fileService.saveFile(part)

        assertTrue(info.fileUrl.startsWith("/uploads/"))
        assertEquals(200L, info.fileSize)
    }

    @Test
    fun `saveFile rejects oversized file`() {
        val data = ByteArray(1024 * 60) // 60KB > 50KB limit
        val part = filePart("huge.zip", "application/zip", data)
        assertThrows(IllegalArgumentException::class.java) {
            fileService.saveFile(part)
        }
    }

    @Test
    fun `getFile returns File for existing upload`() {
        val data = "hello".toByteArray()
        val part = filePart("test.txt", "text/plain", data)
        val info = fileService.saveFile(part)
        val fileName = info.fileUrl.removePrefix("/uploads/")

        val file = fileService.getFile(fileName)
        assertNotNull(file)
        assertTrue(file!!.exists())
    }

    @Test
    fun `getFile returns null for nonexistent file`() {
        assertNull(fileService.getFile("nonexistent.txt"))
    }

    @Test
    fun `saveImage creates upload directory if missing`() {
        val subDir = tempDir.resolve("nested")
        val service = FileService(subDir.toString())
        val data = ByteArray(100)
        val part = filePart("img.png", "image/png", data)
        service.saveImage(part)
        assertTrue(Files.exists(subDir))
    }
}
