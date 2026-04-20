package repository

import chatroom.jooq.generated.Tables.ROOM_MEMBERS
import chatroom.jooq.generated.Tables.USERS
import model.User
import org.jooq.DSLContext

class RoomMemberRepository(private val dsl: DSLContext, private val userRepo: UserRepository) {

    fun addMember(roomId: Int, userId: Int, role: String = "member") {
        dsl.insertInto(ROOM_MEMBERS)
            .set(ROOM_MEMBERS.ROOM_ID, roomId)
            .set(ROOM_MEMBERS.USER_ID, userId)
            .set(ROOM_MEMBERS.ROLE, role)
            .onConflict(ROOM_MEMBERS.ROOM_ID, ROOM_MEMBERS.USER_ID)
            .doNothing()
            .execute()
    }

    fun removeMember(roomId: Int, userId: Int) {
        dsl.deleteFrom(ROOM_MEMBERS)
            .where(ROOM_MEMBERS.ROOM_ID.eq(roomId))
            .and(ROOM_MEMBERS.USER_ID.eq(userId))
            .execute()
    }

    fun getRoomMembers(roomId: Int): List<User> {
        return dsl.select(
            USERS.ID, USERS.USERNAME, USERS.AVATAR_URL,
            USERS.CREATED_AT, USERS.LAST_SEEN, USERS.BIO, USERS.STATUS,
            USERS.ROLE, USERS.IS_DISABLED, USERS.MUTED_UNTIL, USERS.MUTE_REASON, USERS.DISABLED_REASON,
            ROOM_MEMBERS.ROLE
        )
            .from(ROOM_MEMBERS)
            .join(USERS).on(ROOM_MEMBERS.USER_ID.eq(USERS.ID))
            .where(ROOM_MEMBERS.ROOM_ID.eq(roomId))
            .fetch()
            .map { record ->
                val roomRole = record.get(ROOM_MEMBERS.ROLE) ?: "member"
                userRepo.mapRecordToUser(record).copy(role = roomRole)
            }
    }

    fun getMemberRole(roomId: Int, userId: Int): String? {
        return dsl.select(ROOM_MEMBERS.ROLE)
            .from(ROOM_MEMBERS)
            .where(ROOM_MEMBERS.ROOM_ID.eq(roomId))
            .and(ROOM_MEMBERS.USER_ID.eq(userId))
            .fetchOne()?.get(ROOM_MEMBERS.ROLE)
    }

    fun updateMemberRole(roomId: Int, userId: Int, role: String) {
        dsl.update(ROOM_MEMBERS)
            .set(ROOM_MEMBERS.ROLE, role)
            .where(ROOM_MEMBERS.ROOM_ID.eq(roomId))
            .and(ROOM_MEMBERS.USER_ID.eq(userId))
            .execute()
    }
}
