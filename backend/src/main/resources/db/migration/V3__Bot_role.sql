-- Add 'bot' as a valid platform role for AI persona users.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'platform_admin', 'user', 'bot'));

-- Migrate existing bot accounts (default suffix _bot) to the new role.
UPDATE users SET role = 'bot' WHERE username LIKE '%\_bot' ESCAPE '\';
