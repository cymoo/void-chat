package service

import config.DatabaseConfig
import model.User
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class UserServiceTest {

    private lateinit var userService: UserService

    @BeforeEach
    fun setUp() {
        val ds = DatabaseConfig.createDataSource("jdbc:sqlite::memory:")
        DatabaseConfig.runMigrations(ds)
        val dsl = DatabaseConfig.createDSLContext(ds)
        userService = UserService(dsl)
    }

    @Test
    fun `register creates new user and returns auth response`() {
        val result = userService.register("alice", "password123")
        assertEquals("alice", result.user.username)
        assertNotNull(result.user.id)
    }

    @Test
    fun `register with blank username throws`() {
        assertThrows<IllegalArgumentException> {
            userService.register("", "password123")
        }
    }

    @Test
    fun `register with short password throws`() {
        assertThrows<IllegalArgumentException> {
            userService.register("alice", "short")
        }
    }

    @Test
    fun `register duplicate username throws`() {
        userService.register("alice", "password123")
        assertThrows<IllegalArgumentException> {
            userService.register("alice", "password456")
        }
    }

    @Test
    fun `login returns user for valid credentials`() {
        userService.register("bob", "password123")
        val user = userService.login("bob", "password123")
        assertNotNull(user)
        assertEquals("bob", user!!.username)
    }

    @Test
    fun `login returns null for wrong password`() {
        userService.register("bob", "password123")
        val user = userService.login("bob", "wrongpassword")
        assertNull(user)
    }

    @Test
    fun `login returns null for nonexistent user`() {
        val user = userService.login("nobody", "password123")
        assertNull(user)
    }

    @Test
    fun `getUserById returns user after registration`() {
        val result = userService.register("carol", "password123")
        val user = userService.getUserById(result.user.id)
        assertNotNull(user)
        assertEquals("carol", user!!.username)
    }

    @Test
    fun `getUserById returns null for nonexistent id`() {
        assertNull(userService.getUserById(9999))
    }

    @Test
    fun `updateProfile updates user fields`() {
        val result = userService.register("dave", "password123")
        val updated = userService.updateProfile(result.user.id, avatarUrl = "http://img.png", bio = "Hello", status = "online")
        assertNotNull(updated)
        assertEquals("http://img.png", updated!!.avatarUrl)
        assertEquals("Hello", updated.bio)
        assertEquals("online", updated.status)
    }

    @Test
    fun `findOrCreateUser creates guest user without password`() {
        val user = userService.findOrCreateUser("guest1")
        assertEquals("guest1", user.username)
        // Guest cannot login (no password)
        assertNull(userService.login("guest1", "anything"))
    }

    @Test
    fun `register can claim legacy guest account`() {
        val guest = userService.findOrCreateUser("legacy")
        val result = userService.register("legacy", "newpassword")
        assertEquals(guest.id, result.user.id)
        // Now can login
        assertNotNull(userService.login("legacy", "newpassword"))
    }
}
