-- ============================================================
-- COMPÉTENCES REQUISES PAR APPAREIL
-- Table de jonction : chaque appareil peut requérir N compétences
-- ============================================================

CREATE TABLE IF NOT EXISTS appareil_competence_ref (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    appareil_id         INTEGER NOT NULL REFERENCES appareil(id)     ON DELETE CASCADE,
    competence_ref_id   INTEGER NOT NULL REFERENCES competence_ref(id) ON DELETE CASCADE,
    UNIQUE(appareil_id, competence_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_acr_appareil ON appareil_competence_ref(appareil_id);
