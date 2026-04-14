CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    avatar_url TEXT,
    bio TEXT,
    status TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'platform_admin', 'user')),
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    disabled_reason TEXT,
    muted_until TIMESTAMPTZ,
    mute_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_disabled ON users(is_disabled);
CREATE INDEX idx_users_muted_until ON users(muted_until);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash TEXT,
    creator_id INTEGER REFERENCES users(id),
    max_users INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Messages use a JSONB `content` column whose shape depends on message_type:
--   text:   {"text": "..."}
--   image:  {"url": "...", "thumbnail": "...", "width": N, "height": N}
--   file:   {"url": "...", "name": "...", "size": N, "mime": "..."}
--   system: {"text": "..."}
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'file', 'system')),
    content JSONB NOT NULL DEFAULT '{}',
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    reply_to_id INTEGER REFERENCES messages(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room_members (
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id)
);

-- Private messages use the same JSONB content convention as room messages.
CREATE TABLE private_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'file')),
    content JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invite_links (
    id SERIAL PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    code_preview TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    max_uses INTEGER CHECK (max_uses > 0),
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (max_uses IS NULL OR used_count <= max_uses)
);

-- Indexes
CREATE INDEX idx_messages_room_id_id ON messages(room_id, id DESC);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX idx_messages_content_text ON messages ((content->>'text')) WHERE message_type IN ('text', 'system');
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_private_messages_participants ON private_messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_private_messages_receiver ON private_messages(receiver_id, is_read);
CREATE INDEX idx_invite_links_code_hash ON invite_links(code_hash);
CREATE INDEX idx_invite_links_created_by ON invite_links(created_by);
