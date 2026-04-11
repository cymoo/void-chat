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
    fun `first registered user is promoted to super admin`() {
        val result = userService.register("root", "password123")
        assertEquals("super_admin", result.user.role)
    }

    @Test
    fun `second registered user defaults to user role`() {
        userService.register("root", "password123")
        val second = userService.register("normal", "password123")
        assertEquals("user", second.user.role)
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

    @Test
    fun `super admin can grant platform admin role`() {
        val superAdmin = userService.register("root", "password123").user
        val target = userService.register("target", "password123").user

        val updated = userService.updateUserRole(superAdmin, target.id, "platform_admin")
        assertNotNull(updated)
        assertEquals("platform_admin", updated!!.role)
    }

    @Test
    fun `platform admin cannot grant super admin role`() {
        val superAdmin = userService.register("root", "password123").user
        val platformAdmin = userService.register("manager", "password123").user
        val target = userService.register("target", "password123").user

        userService.updateUserRole(superAdmin, platformAdmin.id, "platform_admin")
        val actor = userService.getUserById(platformAdmin.id)!!

        assertThrows<IllegalArgumentException> {
            userService.updateUserRole(actor, target.id, "super_admin")
        }
    }

    @Test
    fun `regular user cannot manage other user roles`() {
        userService.register("root", "password123")
        val actor = userService.register("actor", "password123").user
        val target = userService.register("target", "password123").user

        assertThrows<IllegalArgumentException> {
            userService.updateUserRole(actor, target.id, "platform_admin")
        }
    }
}
