package repository

import chatroom.jooq.generated.Tables.USERS
import com.github.benmanes.caffeine.cache.Caffeine
import model.User
import org.jooq.DSLContext
import org.jooq.Record
import service.AuthorizationService
import util.toEpochMillis
import util.toEpochMillisOrNull
import java.time.Duration
import java.time.OffsetDateTime
import java.time.ZoneOffset

/** Internal record that includes sensitive auth fields not exposed in the User model. */
data class AuthUser(val user: User, val passwordHash: String?)

/**
 * Repository for user persistence.
 *
 * Uses a Caffeine local cache (1000 entries, 2-min TTL) to avoid redundant
 * DB lookups on hot paths (e.g., per-message auth checks).
 */
class UserRepository(private val dsl: DSLContext) {

    private val userFields = arrayOf(
        USERS.ID, USERS.USERNAME, USERS.AVATAR_URL,
        USERS.CREATED_AT, USERS.LAST_SEEN, USERS.BIO, USERS.STATUS, USERS.ROLE,
        USERS.IS_DISABLED, USERS.DISABLED_REASON, USERS.MUTED_UNTIL, USERS.MUTE_REASON
    )

    private val userCache = Caffeine.newBuilder()
        .maximumSize(1000)
        .expireAfterWrite(Duration.ofMinutes(2))
        .build<Int, User>()

    fun findByUsername(username: String): User? = findByUsernameForAuth(username)?.user

    fun findByUsernameForAuth(username: String): AuthUser? {
        return dsl.select(*userFields, USERS.PASSWORD_HASH)
            .from(USERS)
            .where(USERS.USERNAME.eq(username))
            .fetchOne()
            ?.let { record ->
                AuthUser(mapRecordToUser(record), record.get(USERS.PASSWORD_HASH))
            }
    }

    fun findById(id: Int): User? {
        return userCache.getIfPresent(id) ?: doFindById(id)?.also { userCache.put(id, it) }
    }

    private fun doFindById(id: Int): User? {
        return dsl.select(*userFields)
            .from(USERS)
            .where(USERS.ID.eq(id))
            .fetchOne()
            ?.let(::mapRecordToUser)
    }

    fun invalidateCache(userId: Int) {
        userCache.invalidate(userId)
    }

    fun listUsers(): List<User> {
        return dsl.select(*userFields)
            .from(USERS)
            .orderBy(USERS.CREATED_AT.desc(), USERS.ID.desc())
            .fetch()
            .map(::mapRecordToUser)
    }

    fun createUser(username: String, passwordHash: String? = null): User {
        val record = dsl.insertInto(USERS)
            .set(USERS.USERNAME, username)
            .set(USERS.PASSWORD_HASH, passwordHash)
            .set(USERS.ROLE, AuthorizationService.ROLE_USER)
            .returningResult(*userFields)
            .fetchOne()!!

        return mapRecordToUser(record)
    }

    fun setPasswordHash(userId: Int, passwordHash: String) {
        dsl.update(USERS)
            .set(USERS.PASSWORD_HASH, passwordHash)
            .where(USERS.ID.eq(userId))
            .execute()
    }

    fun updateRole(userId: Int, role: String): Boolean {
        return dsl.update(USERS)
            .set(USERS.ROLE, role)
            .where(USERS.ID.eq(userId))
            .execute().also { if (it > 0) invalidateCache(userId) } > 0
    }

    fun countByRole(role: String): Int {
        return dsl.fetchCount(
            dsl.selectFrom(USERS).where(USERS.ROLE.eq(role))
        )
    }

    fun countActiveByRole(role: String): Int {
        return dsl.fetchCount(
            dsl.selectFrom(USERS)
                .where(USERS.ROLE.eq(role))
                .and(USERS.IS_DISABLED.eq(false))
        )
    }

    fun updateDisabled(userId: Int, disabled: Boolean, reason: String?): Boolean {
        return dsl.update(USERS)
            .set(USERS.IS_DISABLED, disabled)
            .set(USERS.DISABLED_REASON, if (disabled) reason else null)
            .where(USERS.ID.eq(userId))
            .execute().also { if (it > 0) invalidateCache(userId) } > 0
    }

    fun updateMute(userId: Int, mutedUntil: OffsetDateTime?, reason: String?): Boolean {
        return dsl.update(USERS)
            .set(USERS.MUTED_UNTIL, mutedUntil)
            .set(USERS.MUTE_REASON, reason)
            .where(USERS.ID.eq(userId))
            .execute().also { if (it > 0) invalidateCache(userId) } > 0
    }

    fun updateLastSeen(userId: Int) {
        dsl.update(USERS)
            .set(USERS.LAST_SEEN, OffsetDateTime.now(ZoneOffset.UTC))
            .where(USERS.ID.eq(userId))
            .execute()
    }

    fun updateProfile(userId: Int, username: String?, avatarUrl: String?, bio: String?, status: String?) {
        if (username == null && avatarUrl == null && bio == null && status == null) return

        var step = dsl.update(USERS).set(USERS.LAST_SEEN, USERS.LAST_SEEN)
        if (username != null) step = step.set(USERS.USERNAME, username)
        if (avatarUrl != null) step = step.set(USERS.AVATAR_URL, avatarUrl)
        if (bio != null) step = step.set(USERS.BIO, bio)
        if (status != null) step = step.set(USERS.STATUS, status)
        step.where(USERS.ID.eq(userId)).execute()
        invalidateCache(userId)
    }

    /**
     * Map a jOOQ record to a [User] model.
     *
     * Capabilities are derived from the platform role at mapping time so that
     * the repository remains free of service-layer dependencies.
     */
    private fun mapRecordToUser(record: Record): User {
        val role = AuthorizationService.normalizePlatformRole(record.get(USERS.ROLE))
        val isDisabled = record.get(USERS.IS_DISABLED) ?: false
        val mutedUntil = record.get(USERS.MUTED_UNTIL).toEpochMillisOrNull()
        val now = System.currentTimeMillis()
        val isMuted = mutedUntil?.let { it > now } ?: false
        return User(
            id = record.get(USERS.ID)!!,
            username = record.get(USERS.USERNAME)!!,
            avatarUrl = record.get(USERS.AVATAR_URL),
            bio = record.get(USERS.BIO),
            status = record.get(USERS.STATUS),
            role = role,
            capabilities = AuthorizationService.capabilitiesForPlatformRole(role),
            isDisabled = isDisabled,
            disabledReason = record.get(USERS.DISABLED_REASON),
            mutedUntil = mutedUntil,
            muteReason = record.get(USERS.MUTE_REASON),
            isMuted = isMuted,
            createdAt = record.get(USERS.CREATED_AT).toEpochMillis(),
            lastSeen = record.get(USERS.LAST_SEEN).toEpochMillis()
        )
    }
}
