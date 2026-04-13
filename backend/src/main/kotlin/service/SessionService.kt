package service

import redis.clients.jedis.JedisPool
import java.util.UUID

/**
 * Redis-backed session management. Sessions survive server restarts.
 */
class SessionService(private val jedisPool: JedisPool) {
    private val sessionTtlSeconds = 7 * 24 * 60 * 60L // 7 days

    private fun sessionKey(token: String) = "session:$token"
    private fun userSessionsKey(userId: Int) = "user_sessions:$userId"

    fun createSession(userId: Int): String {
        val token = UUID.randomUUID().toString()
        jedisPool.resource.use { jedis ->
            jedis.setex(sessionKey(token), sessionTtlSeconds, userId.toString())
            jedis.sadd(userSessionsKey(userId), token)
            jedis.expire(userSessionsKey(userId), sessionTtlSeconds)
        }
        return token
    }

    fun validateSession(token: String): Int? {
        return jedisPool.resource.use { jedis ->
            jedis.get(sessionKey(token))?.toIntOrNull()
        }
    }

    fun invalidateSession(token: String) {
        jedisPool.resource.use { jedis ->
            val userId = jedis.get(sessionKey(token))?.toIntOrNull()
            jedis.del(sessionKey(token))
            if (userId != null) {
                jedis.srem(userSessionsKey(userId), token)
            }
        }
    }

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
