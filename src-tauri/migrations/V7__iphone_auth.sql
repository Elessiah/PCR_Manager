-- Records d'appairage iPhone : clé publique P-256 permanente + compteur anti-rejeu
CREATE TABLE IF NOT EXISTS iphone_pairing (
    id           INTEGER PRIMARY KEY,
    pairing_id   TEXT UNIQUE NOT NULL,        -- UUID, référence croisée iOS↔Mac
    iphone_device_id   TEXT NOT NULL,         -- hash stable de l'identifiant vendor iOS
    iphone_device_name TEXT NOT NULL,         -- nom lisible "iPhone de Jean"
    iphone_public_key  BLOB NOT NULL,         -- P-256 uncompressed point, 65 bytes (x963)
    auth_counter       INTEGER NOT NULL DEFAULT 0,  -- compteur monotone anti-rejeu
    paired_at          TEXT NOT NULL,         -- datetime ISO8601
    last_auth_at       TEXT,
    active             INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_iphone_pairing_active ON iphone_pairing(active);
CREATE INDEX IF NOT EXISTS idx_iphone_pairing_device ON iphone_pairing(iphone_device_id);
