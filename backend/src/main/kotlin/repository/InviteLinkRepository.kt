package repository

import chatroom.jooq.generated.Tables.INVITE_LINKS
import chatroom.jooq.generated.Tables.USERS
import model.InviteLink
import org.jooq.DSLContext
import org.jooq.Record
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

class InviteLinkRepository(private val dsl: DSLContext) {

    private val creator = USERS.`as`("creator")

    fun create(
        codeHash: String,
        codePreview: String,
        createdByUserId: Int,
        maxUses: Int?,
        expiresAt: OffsetDateTime?
    ): InviteLink {
        val id = dsl.insertInto(INVITE_LINKS)
            .set(INVITE_LINKS.CODE_HASH, codeHash)
            .set(INVITE_LINKS.CODE_PREVIEW, codePreview)
            .set(INVITE_LINKS.CREATED_BY, createdByUserId)
            .set(INVITE_LINKS.MAX_USES, maxUses)
            .set(INVITE_LINKS.EXPIRES_AT, expiresAt)
            .returningResult(INVITE_LINKS.ID)
            .fetchOne()!!
            .get(INVITE_LINKS.ID)!!
        return findById(id)!!
    }

    fun findById(inviteId: Int): InviteLink? {
        return baseSelect()
            .where(INVITE_LINKS.ID.eq(inviteId))
            .fetchOne()
            ?.let(::mapRecordToInvite)
    }

    fun findByHash(codeHash: String): InviteLink? {
        return baseSelect()
            .where(INVITE_LINKS.CODE_HASH.eq(codeHash))
            .fetchOne()
            ?.let(::mapRecordToInvite)
    }

    fun listInvites(): List<InviteLink> {
        return baseSelect()
            .orderBy(INVITE_LINKS.CREATED_AT.desc(), INVITE_LINKS.ID.desc())
            .fetch()
            .map(::mapRecordToInvite)
    }

    fun revoke(inviteId: Int, nowUtc: OffsetDateTime): Boolean {
        return dsl.update(INVITE_LINKS)
            .set(INVITE_LINKS.REVOKED_AT, nowUtc)
            .where(INVITE_LINKS.ID.eq(inviteId))
            .and(INVITE_LINKS.REVOKED_AT.isNull)
            .execute() > 0
    }

    fun consumeByHash(codeHash: String, nowUtc: OffsetDateTime): Boolean {
        return dsl.update(INVITE_LINKS)
            .set(INVITE_LINKS.USED_COUNT, INVITE_LINKS.USED_COUNT.plus(1))
            .where(INVITE_LINKS.CODE_HASH.eq(codeHash))
            .and(INVITE_LINKS.REVOKED_AT.isNull)
            .and(INVITE_LINKS.EXPIRES_AT.isNull.or(INVITE_LINKS.EXPIRES_AT.gt(nowUtc)))
            .and(INVITE_LINKS.MAX_USES.isNull.or(INVITE_LINKS.USED_COUNT.lt(INVITE_LINKS.MAX_USES)))
            .execute() > 0
    }

    private fun baseSelect() = dsl.select(
        INVITE_LINKS.ID,
        INVITE_LINKS.CODE_PREVIEW,
        INVITE_LINKS.CREATED_BY,
        INVITE_LINKS.MAX_USES,
        INVITE_LINKS.USED_COUNT,
        INVITE_LINKS.EXPIRES_AT,
        INVITE_LINKS.REVOKED_AT,
        INVITE_LINKS.CREATED_AT,
        creator.USERNAME
    )
        .from(INVITE_LINKS)
        .leftJoin(creator).on(INVITE_LINKS.CREATED_BY.eq(creator.ID))

    private fun mapRecordToInvite(record: Record): InviteLink {
        val createdAt = parseTimestamp(record.get(INVITE_LINKS.CREATED_AT))
        val revokedAt = parseTimestampOrNull(record.get(INVITE_LINKS.REVOKED_AT))
        val expiresAt = parseTimestampOrNull(record.get(INVITE_LINKS.EXPIRES_AT))
        val usedCount = record.get(INVITE_LINKS.USED_COUNT) ?: 0
        val maxUses = record.get(INVITE_LINKS.MAX_USES)
        val now = System.currentTimeMillis()
        val isActive = revokedAt == null &&
            (expiresAt == null || expiresAt > now) &&
            (maxUses == null || usedCount < maxUses)

        return InviteLink(
            id = record.get(INVITE_LINKS.ID)!!,
            codePreview = record.get(INVITE_LINKS.CODE_PREVIEW)!!,
            createdByUserId = record.get(INVITE_LINKS.CREATED_BY)!!,
            createdByUsername = record.get(creator.USERNAME),
            maxUses = maxUses,
            usedCount = usedCount,
            expiresAt = expiresAt,
            revokedAt = revokedAt,
            createdAt = createdAt,
            isActive = isActive
        )
    }

    private fun parseTimestamp(timestamp: OffsetDateTime?): Long {
        return timestamp?.toInstant()?.toEpochMilli()
            ?: Instant.now().toEpochMilli()
    }

    private fun parseTimestampOrNull(timestamp: OffsetDateTime?): Long? {
        return timestamp?.toInstant()?.toEpochMilli()
    }
}
