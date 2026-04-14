package service

import redis.clients.jedis.JedisPool
import java.util.UUID

/**
 * Redis-backed session management. Sessions survive server restarts.
 *
 * @param jedisPool  Redis connection pool.
 * @param sessionTtlDays  Session time-to-live in days (default: 7).
 */
class SessionService(
    private val jedisPool: JedisPool,
    sessionTtlDays: Long = 7
) {
    private val sessionTtlSeconds = sessionTtlDays * 24 * 60 * 60L

    private fun sessionKey(token: String) = "session:$token"
    private fun userSessionsKey(userId: Int) = "user_sessions:$userId"

    /** Create a new session token for [userId] and store it in Redis. */
    fun createSession(userId: Int): String {
        val token = UUID.randomUUID().toString()
        jedisPool.resource.use { jedis ->
            jedis.setex(sessionKey(token), sessionTtlSeconds, userId.toString())
            jedis.sadd(userSessionsKey(userId), token)
            jedis.expire(userSessionsKey(userId), sessionTtlSeconds)
        }
        return token
    }

    /** Validate a token and return the associated user ID, or null if expired/invalid. */
    fun validateSession(token: String): Int? {
        return jedisPool.resource.use { jedis ->
            jedis.get(sessionKey(token))?.toIntOrNull()
        }
    }

    /** Revoke a single session token. */
    fun invalidateSession(token: String) {
        jedisPool.resource.use { jedis ->
            val userId = jedis.get(sessionKey(token))?.toIntOrNull()
            jedis.del(sessionKey(token))
            if (userId != null) {
                jedis.srem(userSessionsKey(userId), token)
            }
        }
    }

    /** Revoke all sessions for a user (e.g., on password change or account disable). */
    fun invalidateSessionsForUser(userId: Int) {
        jedisPool.resource.use { jedis ->
            val tokens = jedis.smembers(userSessionsKey(userId))
            if (tokens.isNotEmpty()) {
                jedis.del(*tokens.map { sessionKey(it) }.toTypedArray())
            }
            jedis.del(userSessionsKey(userId))
        }
    }
}
