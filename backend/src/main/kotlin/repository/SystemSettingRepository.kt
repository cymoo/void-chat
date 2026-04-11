package repository

import chatroom.jooq.generated.Tables.SYSTEM_SETTINGS
import org.jooq.DSLContext
import java.time.LocalDateTime
import java.time.ZoneOffset

class SystemSettingRepository(private val dsl: DSLContext) {

    fun getValue(key: String): String? {
        return dsl.select(SYSTEM_SETTINGS.VALUE)
            .from(SYSTEM_SETTINGS)
            .where(SYSTEM_SETTINGS.KEY.eq(key))
            .fetchOne(SYSTEM_SETTINGS.VALUE)
    }

    fun setValue(key: String, value: String) {
        dsl.insertInto(SYSTEM_SETTINGS)
            .set(SYSTEM_SETTINGS.KEY, key)
            .set(SYSTEM_SETTINGS.VALUE, value)
            .set(SYSTEM_SETTINGS.UPDATED_AT, LocalDateTime.now(ZoneOffset.UTC))
            .onConflict(SYSTEM_SETTINGS.KEY)
            .doUpdate()
            .set(SYSTEM_SETTINGS.VALUE, value)
            .set(SYSTEM_SETTINGS.UPDATED_AT, LocalDateTime.now(ZoneOffset.UTC))
            .execute()
    }
}
