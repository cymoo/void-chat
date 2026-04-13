INSERT INTO rooms (name, description) VALUES
    ('general', 'General discussion room'),
    ('random', 'Random chat and off-topic'),
    ('tech', 'Technology and programming')
ON CONFLICT (name) DO NOTHING;

INSERT INTO system_settings (key, value)
VALUES ('registration_mode', 'open')
ON CONFLICT (key) DO NOTHING;
