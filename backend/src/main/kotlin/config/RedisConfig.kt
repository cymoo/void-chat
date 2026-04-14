package config

import redis.clients.jedis.JedisPool
import redis.clients.jedis.JedisPoolConfig
import java.net.URI

/**
 * Redis connection pool factory (Jedis). Used for session storage and pub/sub broadcasting.
 */
object RedisConfig {

    /** Create a Jedis connection pool from a `redis://host:port` URL. */
    fun createPool(redisUrl: String): JedisPool {
        val config = JedisPoolConfig().apply {
            maxTotal = 16
            maxIdle = 8
            minIdle = 2
        }
        return JedisPool(config, URI(redisUrl))
    }
}
