package util

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.jooq.JSONB

/**
 * Shared utilities for JSONB serialization/deserialization used by message repositories.
 */
object JsonbUtils {

    val objectMapper = ObjectMapper()

    /** Parse JSONB content column into a Map. Returns empty map on null/error. */
    fun parseContent(jsonb: JSONB?): Map<String, Any?> {
        if (jsonb == null) return emptyMap()
        return try {
            objectMapper.readValue(jsonb.data())
        } catch (_: Exception) {
            emptyMap()
        }
    }

    /** Build a JSONB literal from key-value pairs, omitting null values. */
    fun jsonbOf(vararg pairs: Pair<String, Any?>): JSONB = jsonbOf(pairs.toMap())

    fun jsonbOf(map: Map<String, Any?>): JSONB {
        val filtered = map.filterValues { it != null }
        val json = filtered.entries.joinToString(",", "{", "}") { (k, v) ->
            val valueStr = when (v) {
                is String -> "\"${escapeJsonString(v)}\""
                else -> v.toString()
            }
            "\"$k\":$valueStr"
        }
        return JSONB.jsonb(json)
    }

    /** Escape special characters for JSON string values. */
    fun escapeJsonString(s: String): String {
        val sb = StringBuilder(s.length + 16)
        for (ch in s) {
            when (ch) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                else -> if (ch.code < 0x20) sb.append("\\u%04x".format(ch.code)) else sb.append(ch)
            }
        }
        return sb.toString()
    }
}
