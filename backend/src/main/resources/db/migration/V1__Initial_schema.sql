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
    muted_until TIMESTAMP,
    mute_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'file', 'system')),
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    thumbnail_url TEXT,
    edited_at TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    reply_to_id INTEGER REFERENCES messages(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room_members (
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE private_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'file')),
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    thumbnail_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invite_links (
    id SERIAL PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    code_preview TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    max_uses INTEGER CHECK (max_uses > 0),
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (max_uses IS NULL OR used_count <= max_uses)
);

-- Indexes
CREATE INDEX idx_messages_room_id_id ON messages(room_id, id DESC);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_private_messages_participants ON private_messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_private_messages_receiver ON private_messages(receiver_id, is_read);
CREATE INDEX idx_invite_links_code_hash ON invite_links(code_hash);
CREATE INDEX idx_invite_links_created_by ON invite_links(created_by);

-- Default rooms
INSERT INTO rooms (name, description) VALUES
    ('general', 'General discussion room'),
    ('random', 'Random chat and off-topic'),
    ('tech', 'Technology and programming');

-- Default system settings
INSERT INTO system_settings(key, value)
VALUES ('registration_mode', 'open')
ON CONFLICT(key) DO NOTHING;
