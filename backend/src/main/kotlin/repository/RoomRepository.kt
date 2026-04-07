package repository

import chatroom.jooq.generated.Tables.MESSAGES
import chatroom.jooq.generated.Tables.ROOMS
import chatroom.jooq.generated.Tables.ROOM_MEMBERS
import chatroom.jooq.generated.tables.records.RoomsRecord
import model.Room
import org.jooq.DSLContext
import org.jooq.impl.DSL.count
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

data class RoomWithOnlineCount(val room: Room, val onlineUsers: Int)

class RoomRepository(private val dsl: DSLContext) {

    fun findAll(): List<Room> {
        return dsl.selectFrom(ROOMS)
            .fetch()
            .map { it.toModel() }
    }

    /** Loads rooms with member counts in one query to avoid N+1 lookups in service layer. */
    fun findAllWithOnlineUserCount(): List<RoomWithOnlineCount> {
        val onlineUsers = count(ROOM_MEMBERS.USER_ID).`as`("online_users")
        return dsl.select(
            ROOMS.ID,
            ROOMS.NAME,
            ROOMS.DESCRIPTION,
            ROOMS.IS_PRIVATE,
            ROOMS.CREATOR_ID,
            ROOMS.CREATED_AT,
            ROOMS.MAX_USERS,
            onlineUsers
        )
            .from(ROOMS)
            .leftJoin(ROOM_MEMBERS).on(ROOM_MEMBERS.ROOM_ID.eq(ROOMS.ID))
            .groupBy(
                ROOMS.ID,
                ROOMS.NAME,
                ROOMS.DESCRIPTION,
                ROOMS.IS_PRIVATE,
                ROOMS.CREATOR_ID,
                ROOMS.CREATED_AT,
                ROOMS.MAX_USERS
            )
            .fetch { record ->
                RoomWithOnlineCount(
                    room = Room(
                        id = record.get(ROOMS.ID)!!,
                        name = record.get(ROOMS.NAME)!!,
                        description = record.get(ROOMS.DESCRIPTION),
                        isPrivate = (record.get(ROOMS.IS_PRIVATE) ?: 0) != 0,
                        creatorId = record.get(ROOMS.CREATOR_ID),
                        createdAt = parseTimestamp(record.get(ROOMS.CREATED_AT)),
                        maxUsers = record.get(ROOMS.MAX_USERS) ?: 100
                    ),
                    onlineUsers = record.get(onlineUsers) ?: 0
                )
            }
    }

    fun findById(id: Int): Room? {
        return dsl.selectFrom(ROOMS)
            .where(ROOMS.ID.eq(id))
            .fetchOne()
            ?.toModel()
    }

    fun findByName(name: String): Room? {
        return dsl.selectFrom(ROOMS)
            .where(ROOMS.NAME.eq(name))
            .fetchOne()
            ?.toModel()
    }

    fun create(name: String, description: String?, isPrivate: Boolean = false, passwordHash: String? = null, creatorId: Int? = null): Room {
        val id = dsl.insertInto(ROOMS)
            .set(ROOMS.NAME, name)
            .set(ROOMS.DESCRIPTION, description)
            .set(ROOMS.IS_PRIVATE, if (isPrivate) 1 else 0)
            .set(ROOMS.PASSWORD_HASH, passwordHash)
            .set(ROOMS.CREATOR_ID, creatorId)
            .returning(ROOMS.ID)
            .fetchOne()!!
            .get(ROOMS.ID)!!

        return findById(id)!!
    }

    /** Returns the stored password hash for a private room, null if room is public or has no password. */
    fun getPasswordHash(roomId: Int): String? {
        return dsl.select(ROOMS.PASSWORD_HASH)
            .from(ROOMS)
            .where(ROOMS.ID.eq(roomId))
            .fetchOne()
            ?.get(ROOMS.PASSWORD_HASH)
    }

    fun getOnlineUserCount(roomId: Int): Int {
        return dsl.selectCount()
            .from(ROOM_MEMBERS)
            .where(ROOM_MEMBERS.ROOM_ID.eq(roomId))
            .fetchOne(0, Int::class.java) ?: 0
    }

    fun delete(roomId: Int) {
        // Remove messages first (no FK cascading in SQLite without pragma)
        dsl.deleteFrom(MESSAGES)
            .where(MESSAGES.ROOM_ID.eq(roomId))
            .execute()
        // Remove all members
        dsl.deleteFrom(ROOM_MEMBERS)
            .where(ROOM_MEMBERS.ROOM_ID.eq(roomId))
            .execute()
        // Delete the room
        dsl.deleteFrom(ROOMS)
            .where(ROOMS.ID.eq(roomId))
            .execute()
    }

    private fun RoomsRecord.toModel(): Room {
        return Room(
            id = this.id!!,
            name = this.name!!,
            description = this.description,
            isPrivate = (this.isPrivate ?: 0) != 0,
            creatorId = this.creatorId,
            createdAt = parseTimestamp(this.createdAt),
            maxUsers = this.maxUsers ?: 100
        )
    }

    private fun parseTimestamp(timestamp: LocalDateTime?): Long {
        return timestamp?.toInstant(ZoneOffset.UTC)?.toEpochMilli()
            ?: Instant.now().toEpochMilli()
    }
}
