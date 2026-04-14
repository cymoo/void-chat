package util

import java.time.Instant
import java.time.OffsetDateTime

/** Convert to epoch millis, defaulting to [Instant.now] if null. */
fun OffsetDateTime?.toEpochMillis(): Long =
    this?.toInstant()?.toEpochMilli() ?: Instant.now().toEpochMilli()

/** Convert to epoch millis, returning null if the receiver is null. */
fun OffsetDateTime?.toEpochMillisOrNull(): Long? =
    this?.toInstant()?.toEpochMilli()
