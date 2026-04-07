package util

import io.github.cymoo.colleen.Context
import io.github.cymoo.colleen.ExtractorFactory
import io.github.cymoo.colleen.ParamExtractor
import io.github.cymoo.colleen.Unauthorized
import java.lang.reflect.Parameter

/**
 * Extracts Bearer token from Authorization header.
 *
 * Header format:
 * Authorization: Bearer <token>
 */
class BearerToken(value: String?) : ParamExtractor<String?>(value) {
    companion object : ExtractorFactory<BearerToken> {
        private const val BEARER_PREFIX = "Bearer "

        override fun build(paramName: String, param: Parameter): (Context) -> BearerToken {
            return { ctx ->
                val authHeader = ctx.header("Authorization")
                val token = authHeader
                    ?.takeIf { it.startsWith(BEARER_PREFIX, ignoreCase = true) }
                    ?.substring(BEARER_PREFIX.length)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }

                BearerToken(token)
            }
        }

    }

    fun getOrNull(): String? = value

    fun require(): String = value ?: throw Unauthorized("Bearer token is required")
}
