package config

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class EnvLoaderTest {

    @Test
    fun `default profile is prod`() {
        val env = EnvLoader()
        assertEquals("prod", env.profile())
        assertTrue(env.isProd)
        assertFalse(env.isDev)
        assertFalse(env.isTest)
    }

    @Test
    fun `profile reads from system property`() {
        val original = System.getProperty("COLLEEN_ENV")
        try {
            System.setProperty("COLLEEN_ENV", "test")
            val env = EnvLoader()
            assertEquals("test", env.profile())
            assertTrue(env.isTest)
        } finally {
            if (original != null) System.setProperty("COLLEEN_ENV", original)
            else System.clearProperty("COLLEEN_ENV")
        }
    }

    @Test
    fun `get returns system property over cache`() {
        val env = EnvLoader()
        val key = "ENVLOADER_TEST_KEY_${System.nanoTime()}"
        System.setProperty(key, "from-system")
        try {
            assertEquals("from-system", env[key])
        } finally {
            System.clearProperty(key)
        }
    }

    @Test
    fun `get returns null for missing key`() {
        val env = EnvLoader()
        assertNull(env["DEFINITELY_MISSING_KEY_${System.nanoTime()}"])
    }

    @Test
    fun `require throws for missing key`() {
        val env = EnvLoader()
        assertThrows(IllegalArgumentException::class.java) {
            env.require("DEFINITELY_MISSING_KEY_${System.nanoTime()}")
        }
    }

    @Test
    fun `require returns value for present key`() {
        val key = "ENVLOADER_REQ_${System.nanoTime()}"
        System.setProperty(key, "value")
        try {
            val env = EnvLoader()
            assertEquals("value", env.require(key))
        } finally {
            System.clearProperty(key)
        }
    }

    @Test
    fun `requireAll throws listing all missing keys`() {
        val env = EnvLoader()
        val k1 = "MISSING_A_${System.nanoTime()}"
        val k2 = "MISSING_B_${System.nanoTime()}"
        val ex = assertThrows(IllegalArgumentException::class.java) {
            env.requireAll(k1, k2)
        }
        assertTrue(ex.message!!.contains(k1))
        assertTrue(ex.message!!.contains(k2))
    }

    @Test
    fun `contains returns false for missing, true for present`() {
        val env = EnvLoader()
        val key = "ENVLOADER_CONTAINS_${System.nanoTime()}"
        assertFalse(key in env)
        System.setProperty(key, "yes")
        try {
            assertTrue(key in env)
        } finally {
            System.clearProperty(key)
        }
    }

    @Test
    fun `load is idempotent`() {
        val env = EnvLoader()
        env.load()
        env.load() // should not throw
    }

    @Test
    fun `isDev recognizes dev and development profiles`() {
        for (profile in listOf("dev", "development")) {
            val original = System.getProperty("COLLEEN_ENV")
            try {
                System.setProperty("COLLEEN_ENV", profile)
                val env = EnvLoader()
                assertTrue(env.isDev, "Expected isDev for profile=$profile")
            } finally {
                if (original != null) System.setProperty("COLLEEN_ENV", original)
                else System.clearProperty("COLLEEN_ENV")
            }
        }
    }
}
