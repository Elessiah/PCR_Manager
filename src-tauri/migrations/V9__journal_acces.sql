-- RGPD Art. 32 -- Journal d'acces aux donnees sensibles (sante, NIR)
CREATE TABLE IF NOT EXISTS journal_acces (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    horodatage  TEXT    NOT NULL DEFAULT (datetime('now')),
    operation   TEXT    NOT NULL CHECK(operation IN ('LECTURE', 'CREATION', 'MODIFICATION', 'SUPPRESSION')),
    entite      TEXT    NOT NULL,
    entite_id   INTEGER,
    champ_nir   INTEGER NOT NULL DEFAULT 0 CHECK(champ_nir IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_ja_horodatage ON journal_acces(horodatage);