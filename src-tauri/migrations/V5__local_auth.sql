-- Authentification locale par PIN hashé (argon2)
-- Une seule ligne attendue (id = 1)
CREATE TABLE IF NOT EXISTS local_credential (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    pin_hash   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
