package config

import redis.clients.jedis.JedisPool
import redis.clients.jedis.JedisPoolConfig
import java.net.URI

object RedisConfig {

    fun createPool(redisUrl: String): JedisPool {
        val config = JedisPoolConfig().apply {
            maxTotal = 16
            maxIdle = 8
            minIdle = 2
        }
        return JedisPool(config, URI(redisUrl))
    }
}
