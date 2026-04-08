-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    avatar_url TEXT,
    bio TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_private INTEGER DEFAULT 0,
    password_hash TEXT,
    creator_id INTEGER REFERENCES users(id),
    max_users INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER,
    message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'file', 'system')),
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    thumbnail_url TEXT,
    edited_at TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    reply_to_id INTEGER REFERENCES messages(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Room members table (tracks who is currently in which room)
CREATE TABLE room_members (
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Private messages table
CREATE TABLE private_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'file')),
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    thumbnail_url TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_messages_room_id_id ON messages(room_id, id DESC);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_private_messages_participants ON private_messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_private_messages_receiver ON private_messages(receiver_id, is_read);

-- Default rooms
INSERT INTO rooms (name, description) VALUES
    ('general', 'General discussion room'),
    ('random', 'Random chat and off-topic'),
    ('tech', 'Technology and programming');
