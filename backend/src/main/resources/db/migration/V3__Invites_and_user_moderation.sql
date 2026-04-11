ALTER TABLE users
    ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0
    CHECK (is_disabled IN (0, 1));

ALTER TABLE users
    ADD COLUMN disabled_reason TEXT;

ALTER TABLE users
    ADD COLUMN muted_until TIMESTAMP;

ALTER TABLE users
    ADD COLUMN mute_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_is_disabled ON users(is_disabled);
CREATE INDEX IF NOT EXISTS idx_users_muted_until ON users(muted_until);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings(key, value)
VALUES ('registration_mode', 'open')
ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS invite_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    code_preview TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (max_uses IS NULL OR max_uses > 0),
    CHECK (used_count >= 0),
    CHECK (max_uses IS NULL OR used_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_invite_links_code_hash ON invite_links(code_hash);
CREATE INDEX IF NOT EXISTS idx_invite_links_created_by ON invite_links(created_by);
