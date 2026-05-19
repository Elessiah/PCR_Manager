-- ============================================================
-- Schéma SQLite — Application Suivi Radioprotection
-- Chiffrement : SQLCipher (AES-256)
-- Dates       : ISO 8601 (TEXT) — ex: '2026-05-15'
-- Booléens    : INTEGER 0/1
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
-- ÉTABLISSEMENTS
-- Un utilisateur gère N établissements.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etablissement (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    denomination        TEXT    NOT NULL,
    statut_juridique    TEXT,
    siret               TEXT    CHECK(siret IS NULL OR length(siret) = 14),
    adresse             TEXT,
    code_postal         TEXT,
    ville               TEXT,
    telephone           TEXT,
    email               TEXT,
    site_internet       TEXT,
    kbis_chemin         TEXT,                        -- chemin relatif dans AppData
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- TRAVAILLEURS
-- Rattachés à un établissement.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS travailleur (
    id                              INTEGER PRIMARY KEY AUTOINCREMENT,
    etablissement_id                INTEGER NOT NULL
                                        REFERENCES etablissement(id)
                                        ON DELETE CASCADE,
    nom                             TEXT    NOT NULL,
    prenom                          TEXT    NOT NULL,
    sexe                            TEXT    CHECK(sexe IN ('M', 'F', 'Autre')),
    date_naissance                  TEXT,
    lieu_naissance                  TEXT,
    pays_naissance                  TEXT,
    fonction                        TEXT    CHECK(fonction IN (
                                        'Cardiologue',
                                        'Cardiologue_liberal',
                                        'MERM',
                                        'Infirmier'
                                    )),
    date_debut_activite             TEXT,
    categorie_reglementaire         TEXT    CHECK(categorie_reglementaire IN ('A', 'B')),
    numero_adeli_rpps               TEXT,
    email                           TEXT,
    telephone                       TEXT,
    -- Données sensibles (chiffrées par SQLCipher au niveau du fichier .db)
    numero_securite_sociale         TEXT,
    numero_porteur_dosimetrie_passive TEXT,
    numero_suivi_medical            TEXT,
    created_at                      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at                      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- HABILITATION
-- Une ligne par travailleur. Statut calculé à la volée dans l'app,
-- jamais stocké (évite la désynchronisation).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habilitation (
    id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
    travailleur_id                      INTEGER NOT NULL UNIQUE
                                            REFERENCES travailleur(id)
                                            ON DELETE CASCADE,
    -- Dosimétrie passive
    dosimetrie_passive_date             TEXT,
    -- Dosimétrie opérationnelle
    dosimetrie_operationnelle_date      TEXT,
    -- Formation RP Travailleurs — renouvellement 3 ans
    formation_rp_travailleurs_date      TEXT,
    -- Formation RP Patients — renouvellement 7 ans
    formation_rp_patients_date          TEXT,
    -- Visite médicale
    visite_medicale_date                TEXT,
    updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- COMPÉTENCES DE RÉFÉRENCE (lookup table)
-- Les 9 compétences fixes définies par le métier.
-- Seed à l'initialisation de l'app.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competence_ref (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    libelle TEXT    NOT NULL,
    ordre   INTEGER NOT NULL UNIQUE
);

-- Données initiales (seed)
INSERT OR IGNORE INTO competence_ref (libelle, ordre) VALUES
    ('Mise sous tension de l''appareil',             1),
    ('Mise en marche de l''appareil',                2),
    ('Enregistrement patient (vérification identité)', 3),
    ('Détection patients à risque',                  4),
    ('Compétence 5',                                 5),
    ('Compétence 6',                                 6),
    ('Compétence 7',                                 7),
    ('Compétence 8',                                 8),
    ('Compétence 9',                                 9);

-- ------------------------------------------------------------
-- APPAREILS
-- Rattachés à un établissement.
-- CRÉÉ AVANT competence_travailleur (qui le référence via FK).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appareil (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    etablissement_id        INTEGER NOT NULL
                                REFERENCES etablissement(id)
                                ON DELETE CASCADE,
    designation             TEXT    NOT NULL,
    marque                  TEXT,
    modele                  TEXT,
    numero_serie            TEXT,
    type                    TEXT    CHECK(type IN ('Fixe', 'Deplacable')),
    annee_mise_en_service   INTEGER,
    lieu_utilisation        TEXT,
    utilisation_partagee    INTEGER NOT NULL DEFAULT 0
                                CHECK(utilisation_partagee IN (0, 1)),
    tension_nominale_kv     REAL,
    intensite_maximale_ma   REAL,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- COMPÉTENCES TRAVAILLEUR ↔ APPAREIL
-- Validation individuelle par (travailleur, appareil, compétence).
-- CRÉÉ APRÈS appareil (qui le référence via FK).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competence_travailleur (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    travailleur_id      INTEGER NOT NULL REFERENCES travailleur(id)  ON DELETE CASCADE,
    appareil_id         INTEGER NOT NULL REFERENCES appareil(id)     ON DELETE CASCADE,
    competence_ref_id   INTEGER NOT NULL REFERENCES competence_ref(id),
    date_validation     TEXT,
    validated           INTEGER NOT NULL DEFAULT 0
                            CHECK(validated IN (0, 1)),
    UNIQUE(travailleur_id, appareil_id, competence_ref_id)
);

-- ------------------------------------------------------------
-- VÉRIFICATIONS TECHNIQUES
-- Annuelle interne + Triennale externe.
-- Le statut est calculé à la volée : date_realisation + période.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_technique (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    appareil_id         INTEGER NOT NULL REFERENCES appareil(id) ON DELETE CASCADE,
    type                TEXT    NOT NULL
                            CHECK(type IN ('annuelle_interne', 'triennale_externe')),
    date_realisation    TEXT    NOT NULL,
    realise_par         TEXT,
    organisme           TEXT,
    observations        TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Vue : prochaine échéance par appareil et type
CREATE VIEW IF NOT EXISTS v_prochaine_verification AS
SELECT
    vt.appareil_id,
    vt.type,
    MAX(vt.date_realisation) AS derniere_date,
    CASE vt.type
        WHEN 'annuelle_interne'   THEN date(MAX(vt.date_realisation), '+1 year')
        WHEN 'triennale_externe'  THEN date(MAX(vt.date_realisation), '+3 years')
    END AS prochaine_echeance
FROM verification_technique vt
GROUP BY vt.appareil_id, vt.type;

-- ------------------------------------------------------------
-- CONTRÔLES QUALITÉ
-- Externe → génère automatiquement 3 internes (J+90, J+180, J+270).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS controle_qualite (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    appareil_id             INTEGER NOT NULL REFERENCES appareil(id) ON DELETE CASCADE,
    type                    TEXT    NOT NULL
                                CHECK(type IN (
                                    'externe',
                                    'partiel_interne',  -- J+90 et J+270
                                    'complet_interne'   -- J+180
                                )),
    date_realisation        TEXT,                       -- NULL si planifié non encore réalisé
    date_echeance           TEXT    NOT NULL,           -- date cible
    controle_externe_id     INTEGER REFERENCES controle_qualite(id), -- parent pour les internes
    organisme               TEXT,
    realise_par             TEXT,
    statut                  TEXT    NOT NULL DEFAULT 'planifie'
                                CHECK(statut IN ('planifie', 'realise', 'en_retard')),
    observations            TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Index pour accélerer les lookups par appareil
CREATE INDEX IF NOT EXISTS idx_cq_appareil ON controle_qualite(appareil_id);

-- ------------------------------------------------------------
-- DOCUMENTS
-- Stockage des chemins vers les fichiers locaux (PDFs, etc.)
-- Les fichiers physiques sont dans le répertoire AppData de l'app.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT    NOT NULL
                        CHECK(entity_type IN ('etablissement', 'travailleur', 'appareil')),
    entity_id       INTEGER NOT NULL,
    type_document   TEXT    NOT NULL,                   -- ex: 'kbis', 'formation', 'controle'
    nom_fichier     TEXT    NOT NULL,
    chemin_relatif  TEXT    NOT NULL,                   -- relatif à AppData de l'app
    uploaded_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- TRIGGERS — mise à jour automatique de updated_at
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_etablissement_updated
    AFTER UPDATE ON etablissement
    BEGIN
        UPDATE etablissement SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS trg_travailleur_updated
    AFTER UPDATE ON travailleur
    BEGIN
        UPDATE travailleur SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS trg_appareil_updated
    AFTER UPDATE ON appareil
    BEGIN
        UPDATE appareil SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS trg_habilitation_updated
    AFTER UPDATE ON habilitation
    BEGIN
        UPDATE habilitation SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- ------------------------------------------------------------
-- TRIGGER — génération automatique des CQ internes
-- À la création d'un contrôle qualité externe, génère J+90, J+180, J+270
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_generer_cq_internes
    AFTER INSERT ON controle_qualite
    WHEN NEW.type = 'externe'
    BEGIN
        -- Contrôle partiel à 3 mois (J+90)
        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'partiel_interne',
             date(NEW.date_echeance, '+3 months'), NEW.id, 'planifie');

        -- Contrôle complet à 6 mois (J+180)
        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'complet_interne',
             date(NEW.date_echeance, '+6 months'), NEW.id, 'planifie');

        -- Contrôle partiel à 9 mois (J+270)
        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'partiel_interne',
             date(NEW.date_echeance, '+9 months'), NEW.id, 'planifie');
    END;
