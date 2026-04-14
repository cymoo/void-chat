package repository

import chatroom.jooq.generated.Tables.ROOMS
import chatroom.jooq.generated.tables.records.RoomsRecord
import model.Room
import org.jooq.DSLContext
import util.toEpochMillis

class RoomRepository(private val dsl: DSLContext) {

    fun findAll(): List<Room> {
        return dsl.selectFrom(ROOMS)
            .fetch()
            .map { it.toModel() }
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

    fun create(
        name: String,
        description: String?,
        isPrivate: Boolean = false,
        passwordHash: String? = null,
        creatorId: Int? = null,
        maxUsers: Int = 100
    ): Room {
        val id = dsl.insertInto(ROOMS)
            .set(ROOMS.NAME, name)
            .set(ROOMS.DESCRIPTION, description)
            .set(ROOMS.IS_PRIVATE, isPrivate)
            .set(ROOMS.PASSWORD_HASH, passwordHash)
            .set(ROOMS.CREATOR_ID, creatorId)
            .set(ROOMS.MAX_USERS, maxUsers)
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

    fun update(
        roomId: Int,
        name: String,
        description: String?,
        isPrivate: Boolean,
        passwordHash: String?,
        maxUsers: Int
    ): Boolean {
        return dsl.update(ROOMS)
            .set(ROOMS.NAME, name)
            .set(ROOMS.DESCRIPTION, description)
            .set(ROOMS.IS_PRIVATE, isPrivate)
            .set(ROOMS.PASSWORD_HASH, passwordHash)
            .set(ROOMS.MAX_USERS, maxUsers)
            .where(ROOMS.ID.eq(roomId))
            .execute() > 0
    }

    /** Delete a room — ON DELETE CASCADE handles messages and memberships. */
    fun delete(roomId: Int) {
        dsl.deleteFrom(ROOMS).where(ROOMS.ID.eq(roomId)).execute()
    }

    private fun RoomsRecord.toModel(): Room {
        return Room(
            id = this.id!!,
            name = this.name!!,
            description = this.description,
            isPrivate = this.isPrivate ?: false,
            creatorId = this.creatorId,
            createdAt = this.createdAt.toEpochMillis(),
            maxUsers = this.maxUsers ?: 100
        )
    }
}
