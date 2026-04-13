package service

import model.CreateInviteLinkResponse
import model.InviteLink
import org.jooq.DSLContext
import org.jooq.exception.DataAccessException
import repository.InviteLinkRepository
import repository.SystemSettingRepository
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Base64

class InvitationService(dsl: DSLContext) {

    companion object {
        const val MODE_OPEN = "open"
        const val MODE_INVITE_ONLY = "invite_only"
        private const val SETTING_REGISTRATION_MODE = "registration_mode"
        private const val DEFAULT_INVITE_EXPIRY_HOURS = 24
    }

    private val inviteRepo = InviteLinkRepository(dsl)
    private val settingsRepo = SystemSettingRepository(dsl)
    private val validModes = setOf(MODE_OPEN, MODE_INVITE_ONLY)
    private val random = SecureRandom()

    fun getRegistrationMode(): String {
        val stored = settingsRepo.getValue(SETTING_REGISTRATION_MODE)?.trim()?.lowercase()
        return stored?.takeIf { it in validModes } ?: MODE_OPEN
    }

    fun updateRegistrationMode(mode: String): String {
        val normalized = mode.trim().lowercase()
        if (normalized !in validModes) {
            throw IllegalArgumentException("Invalid registration mode")
        }
        settingsRepo.setValue(SETTING_REGISTRATION_MODE, normalized)
        return normalized
    }

    fun createInvite(createdByUserId: Int, maxUses: Int?, expiresInHours: Int?): CreateInviteLinkResponse {
        if (maxUses != null && maxUses <= 0) {
            throw IllegalArgumentException("maxUses must be greater than 0")
        }
        if (expiresInHours != null && expiresInHours <= 0) {
            throw IllegalArgumentException("expiresInHours must be greater than 0")
        }

        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val expiresAt = when {
            expiresInHours != null -> now.plusHours(expiresInHours.toLong())
            else -> now.plusHours(DEFAULT_INVITE_EXPIRY_HOURS.toLong())
        }

        repeat(5) { attempt ->
            val code = generateInviteCode()
            val codeHash = sha256(code)
            try {
                val invite = inviteRepo.create(
                    codeHash = codeHash,
                    codePreview = "${code.take(6)}...",
                    createdByUserId = createdByUserId,
                    maxUses = maxUses,
                    expiresAt = expiresAt
                )
                return CreateInviteLinkResponse(invite = invite, code = code)
            } catch (e: DataAccessException) {
                if (attempt == 4) {
                    throw IllegalStateException("Failed to create invite link")
                }
            }
        }

        throw IllegalStateException("Failed to create invite link")
    }

    fun listInvites(): List<InviteLink> = inviteRepo.listInvites()

    fun revokeInvite(inviteId: Int): InviteLink? {
        val updated = inviteRepo.revoke(inviteId, OffsetDateTime.now(ZoneOffset.UTC))
        if (!updated) return null
        return inviteRepo.findById(inviteId)
    }

    fun validateAndConsumeRegistrationInvite(inviteCode: String?) {
        val mode = getRegistrationMode()
        val normalizedCode = inviteCode?.trim()?.takeIf { it.isNotEmpty() }
        if (normalizedCode == null) {
            if (mode == MODE_INVITE_ONLY) {
                throw IllegalArgumentException("Invite code is required")
            }
            return
        }

        val consumed = inviteRepo.consumeByHash(
            codeHash = sha256(normalizedCode),
            nowUtc = OffsetDateTime.now(ZoneOffset.UTC)
        )
        if (!consumed) {
            throw IllegalArgumentException("Invite code is invalid or expired")
        }
    }

    private fun generateInviteCode(): String {
        val bytes = ByteArray(18)
        random.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun sha256(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(StandardCharsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
