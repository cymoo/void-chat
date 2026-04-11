package repository

import chatroom.jooq.generated.Tables.USERS
import model.User
import org.jooq.DSLContext
import org.jooq.Record
import service.AuthorizationService
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

/** Internal record that includes sensitive auth fields not exposed in the User model. */
data class AuthUser(val user: User, val passwordHash: String?)

class UserRepository(private val dsl: DSLContext) {

    private val authorizationService = AuthorizationService()
    private val userFields = arrayOf(
        USERS.ID, USERS.USERNAME, USERS.AVATAR_URL,
        USERS.CREATED_AT, USERS.LAST_SEEN, USERS.BIO, USERS.STATUS, USERS.ROLE,
        USERS.IS_DISABLED, USERS.DISABLED_REASON, USERS.MUTED_UNTIL, USERS.MUTE_REASON
    )

    fun findByUsername(username: String): User? = findByUsernameForAuth(username)?.user

    fun findByUsernameForAuth(username: String): AuthUser? {
        return dsl.select(
            *userFields,
            USERS.PASSWORD_HASH
        )
            .from(USERS)
            .where(USERS.USERNAME.eq(username))
            .fetchOne()
            ?.let { record ->
                AuthUser(
                    user = mapRecordToUser(record),
                    passwordHash = record.get(USERS.PASSWORD_HASH)
                )
            }
    }

    fun findById(id: Int): User? {
        return dsl.select(*userFields)
            .from(USERS)
            .where(USERS.ID.eq(id))
            .fetchOne()
            ?.let(::mapRecordToUser)
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
            .execute() > 0
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
                .and(USERS.IS_DISABLED.eq(0).or(USERS.IS_DISABLED.isNull))
        )
    }

    fun updateDisabled(userId: Int, disabled: Boolean, reason: String?): Boolean {
        return dsl.update(USERS)
            .set(USERS.IS_DISABLED, if (disabled) 1 else 0)
            .set(USERS.DISABLED_REASON, if (disabled) reason else null)
            .where(USERS.ID.eq(userId))
            .execute() > 0
    }

    fun updateMute(userId: Int, mutedUntil: LocalDateTime?, reason: String?): Boolean {
        return dsl.update(USERS)
            .set(USERS.MUTED_UNTIL, mutedUntil)
            .set(USERS.MUTE_REASON, reason)
            .where(USERS.ID.eq(userId))
            .execute() > 0
    }

    fun updateLastSeen(userId: Int) {
        dsl.update(USERS)
            .set(USERS.LAST_SEEN, LocalDateTime.now(ZoneOffset.UTC))
            .where(USERS.ID.eq(userId))
            .execute()
    }

    fun updateProfile(userId: Int, avatarUrl: String?, bio: String?, status: String?) {
        if (avatarUrl == null && bio == null && status == null) return

        var step = dsl.update(USERS).set(USERS.LAST_SEEN, USERS.LAST_SEEN)
        if (avatarUrl != null) step = step.set(USERS.AVATAR_URL, avatarUrl)
        if (bio != null) step = step.set(USERS.BIO, bio)
        if (status != null) step = step.set(USERS.STATUS, status)
        step.where(USERS.ID.eq(userId)).execute()
    }

    private fun mapRecordToUser(record: Record): User {
        val role = authorizationService.normalizePlatformRole(record.get(USERS.ROLE))
        val isDisabled = (record.get(USERS.IS_DISABLED) ?: 0) != 0
        val mutedUntil = parseTimestampOrNull(record.get(USERS.MUTED_UNTIL))
        val now = System.currentTimeMillis()
        val isMuted = mutedUntil?.let { it > now } ?: false
        return User(
            id = record.get(USERS.ID)!!,
            username = record.get(USERS.USERNAME)!!,
            avatarUrl = record.get(USERS.AVATAR_URL),
            bio = record.get(USERS.BIO),
            status = record.get(USERS.STATUS),
            role = role,
            capabilities = authorizationService.capabilitiesForPlatformRole(role),
            isDisabled = isDisabled,
            disabledReason = record.get(USERS.DISABLED_REASON),
            mutedUntil = mutedUntil,
            muteReason = record.get(USERS.MUTE_REASON),
            isMuted = isMuted,
            createdAt = parseTimestamp(record.get(USERS.CREATED_AT)),
            lastSeen = parseTimestamp(record.get(USERS.LAST_SEEN))
        )
    }

    private fun parseTimestamp(timestamp: LocalDateTime?): Long {
        return timestamp?.toInstant(ZoneOffset.UTC)?.toEpochMilli()
            ?: Instant.now().toEpochMilli()
    }

    private fun parseTimestampOrNull(timestamp: LocalDateTime?): Long? {
        return timestamp?.toInstant(ZoneOffset.UTC)?.toEpochMilli()
    }
}
