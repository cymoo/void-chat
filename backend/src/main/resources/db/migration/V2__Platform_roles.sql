ALTER TABLE users
    ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('super_admin', 'platform_admin', 'user'));

UPDATE users
SET role = 'user'
WHERE role IS NULL OR TRIM(role) = '';

UPDATE users
SET role = 'super_admin'
WHERE id = (SELECT MIN(id) FROM users);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
