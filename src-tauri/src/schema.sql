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
    kbis_chemin         TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- TRAVAILLEURS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS travailleur (
    id                                INTEGER PRIMARY KEY AUTOINCREMENT,
    etablissement_id                  INTEGER NOT NULL
                                          REFERENCES etablissement(id)
                                          ON DELETE CASCADE,
    nom                               TEXT    NOT NULL,
    prenom                            TEXT    NOT NULL,
    sexe                              TEXT    CHECK(sexe IN ('M', 'F', 'Autre')),
    date_naissance                    TEXT,
    lieu_naissance                    TEXT,
    pays_naissance                    TEXT,
    fonction                          TEXT    CHECK(fonction IN (
                                          'Cardiologue',
                                          'Cardiologue_liberal',
                                          'MERM',
                                          'Infirmier'
                                      )),
    date_debut_activite               TEXT,
    categorie_reglementaire           TEXT    CHECK(categorie_reglementaire IN ('A', 'B')),
    numero_adeli_rpps                 TEXT,
    email                             TEXT,
    telephone                         TEXT,
    numero_securite_sociale           TEXT,
    numero_porteur_dosimetrie_passive TEXT,
    numero_suivi_medical              TEXT,
    created_at                        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at                        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- HABILITATION
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habilitation (
    id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
    travailleur_id                      INTEGER NOT NULL UNIQUE
                                            REFERENCES travailleur(id)
                                            ON DELETE CASCADE,
    dosimetrie_passive_date             TEXT,
    dosimetrie_operationnelle_date      TEXT,
    formation_rp_travailleurs_date      TEXT,
    formation_rp_patients_date          TEXT,
    visite_medicale_date                TEXT,
    updated_at                          TEXT    NOT NULL DEFAULT (datetime('now')),
    visite_medicale_date_peremption     TEXT,
    visite_medicale_duree_mois          INTEGER
);

-- ------------------------------------------------------------
-- COMPÉTENCES DE RÉFÉRENCE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competence_ref (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    libelle             TEXT    NOT NULL,
    ordre               INTEGER NOT NULL UNIQUE,
    description         TEXT,
    propre_appareil     INTEGER NOT NULL DEFAULT 1 CHECK(propre_appareil IN (0, 1)),
    duree_validite_mois INTEGER,
    duree_alerte_mois   INTEGER NOT NULL DEFAULT 3
);

INSERT OR IGNORE INTO competence_ref (libelle, ordre) VALUES
    ('Mise sous tension de l''appareil',               1),
    ('Mise en marche de l''appareil',                  2),
    ('Enregistrement patient (vérification identité)', 3),
    ('Détection patients à risque',                    4),
    ('Compétence 5',                                   5),
    ('Compétence 6',                                   6),
    ('Compétence 7',                                   7),
    ('Compétence 8',                                   8),
    ('Compétence 9',                                   9);

-- ------------------------------------------------------------
-- APPAREILS
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
-- COMPÉTENCES REQUISES PAR APPAREIL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appareil_competence_ref (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    appareil_id       INTEGER NOT NULL REFERENCES appareil(id)       ON DELETE CASCADE,
    competence_ref_id INTEGER NOT NULL REFERENCES competence_ref(id) ON DELETE CASCADE,
    UNIQUE(appareil_id, competence_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_acr_appareil ON appareil_competence_ref(appareil_id);

-- ------------------------------------------------------------
-- COMPÉTENCES TRAVAILLEUR ↔ APPAREIL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competence_travailleur (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    travailleur_id    INTEGER NOT NULL REFERENCES travailleur(id)    ON DELETE CASCADE,
    appareil_id       INTEGER NOT NULL REFERENCES appareil(id)       ON DELETE CASCADE,
    competence_ref_id INTEGER NOT NULL REFERENCES competence_ref(id) ON DELETE CASCADE,
    date_validation   TEXT,
    validated         INTEGER NOT NULL DEFAULT 0 CHECK(validated IN (0, 1)),
    date_peremption   TEXT,
    UNIQUE(travailleur_id, appareil_id, competence_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_ct_travailleur ON competence_travailleur(travailleur_id);

-- ------------------------------------------------------------
-- COMPÉTENCES GÉNÉRALES (indépendantes de l'appareil)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competence_travailleur_general (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    travailleur_id    INTEGER NOT NULL REFERENCES travailleur(id)    ON DELETE CASCADE,
    competence_ref_id INTEGER NOT NULL REFERENCES competence_ref(id) ON DELETE CASCADE,
    date_validation   TEXT,
    date_peremption   TEXT,
    validated         INTEGER NOT NULL DEFAULT 0 CHECK(validated IN (0, 1)),
    UNIQUE(travailleur_id, competence_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_ctg_travailleur ON competence_travailleur_general(travailleur_id);

-- ------------------------------------------------------------
-- ASSIGNATION TRAVAILLEUR ↔ APPAREIL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS travailleur_appareil (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    travailleur_id INTEGER NOT NULL REFERENCES travailleur(id) ON DELETE CASCADE,
    appareil_id    INTEGER NOT NULL REFERENCES appareil(id)    ON DELETE CASCADE,
    UNIQUE(travailleur_id, appareil_id)
);

CREATE INDEX IF NOT EXISTS idx_ta_travailleur ON travailleur_appareil(travailleur_id);

-- ------------------------------------------------------------
-- VÉRIFICATIONS TECHNIQUES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_technique (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    appareil_id      INTEGER NOT NULL REFERENCES appareil(id) ON DELETE CASCADE,
    type             TEXT    NOT NULL
                         CHECK(type IN ('annuelle_interne', 'triennale_externe')),
    date_realisation TEXT    NOT NULL,
    realise_par      TEXT,
    organisme        TEXT,
    observations     TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE VIEW IF NOT EXISTS v_prochaine_verification AS
SELECT
    vt.appareil_id,
    vt.type,
    MAX(vt.date_realisation) AS derniere_date,
    CASE vt.type
        WHEN 'annuelle_interne'  THEN date(MAX(vt.date_realisation), '+1 year')
        WHEN 'triennale_externe' THEN date(MAX(vt.date_realisation), '+3 years')
    END AS prochaine_echeance
FROM verification_technique vt
GROUP BY vt.appareil_id, vt.type;

-- ------------------------------------------------------------
-- CONTRÔLES QUALITÉ
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS controle_qualite (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    appareil_id         INTEGER NOT NULL REFERENCES appareil(id) ON DELETE CASCADE,
    type                TEXT    NOT NULL
                            CHECK(type IN ('externe', 'partiel_interne', 'complet_interne')),
    date_realisation    TEXT,
    date_echeance       TEXT    NOT NULL,
    controle_externe_id INTEGER REFERENCES controle_qualite(id),
    organisme           TEXT,
    realise_par         TEXT,
    statut              TEXT    NOT NULL DEFAULT 'planifie'
                            CHECK(statut IN ('planifie', 'realise', 'en_retard')),
    observations        TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cq_appareil ON controle_qualite(appareil_id);

-- ------------------------------------------------------------
-- DOCUMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type    TEXT    NOT NULL
                       CHECK(entity_type IN ('etablissement', 'travailleur', 'appareil')),
    entity_id      INTEGER NOT NULL,
    type_document  TEXT    NOT NULL,
    nom_fichier    TEXT    NOT NULL,
    chemin_relatif TEXT    NOT NULL,
    uploaded_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- JOURNAL D'ACCÈS (RGPD Art. 32)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_acces (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    horodatage TEXT    NOT NULL DEFAULT (datetime('now')),
    operation  TEXT    NOT NULL CHECK(operation IN ('LECTURE', 'CREATION', 'MODIFICATION', 'SUPPRESSION')),
    entite     TEXT    NOT NULL,
    entite_id  INTEGER,
    champ_nir  INTEGER NOT NULL DEFAULT 0 CHECK(champ_nir IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_ja_horodatage ON journal_acces(horodatage);

-- ------------------------------------------------------------
-- REGISTRE DES TRAITEMENTS (CNIL)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registre_traitement (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    code               TEXT NOT NULL UNIQUE,
    finalite           TEXT NOT NULL,
    base_legale        TEXT NOT NULL,
    categories_donnees TEXT NOT NULL,
    duree_conservation TEXT NOT NULL,
    destinataires      TEXT,
    mesures_securite   TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO registre_traitement
    (code, finalite, base_legale, categories_donnees, duree_conservation, destinataires, mesures_securite)
VALUES
    ('DOSIMETRIE_NIR',
     'Suivi dosimetrique des travailleurs exposes aux rayonnements ionisants',
     'Code du travail Art. L4451-1 et R4453-1 -- obligation legale employeur',
     'NIR, nom, prenom, date naissance, categorie reglementaire, donnees dosimeriques',
     'Duree emploi + 10 ans (Code du travail R4453-23)',
     'PCR (Personne Competente en Radioprotection) uniquement',
     'Chiffrement AES-256 SQLCipher, acces authentifie, journal_acces (RGPD Art. 32)');

-- ------------------------------------------------------------
-- TRIGGERS — updated_at automatique
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
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_generer_cq_internes
    AFTER INSERT ON controle_qualite
    WHEN NEW.type = 'externe'
    BEGIN
        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'partiel_interne',
             date(NEW.date_echeance, '+3 months'), NEW.id, 'planifie');

        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'complet_interne',
             date(NEW.date_echeance, '+6 months'), NEW.id, 'planifie');

        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'partiel_interne',
             date(NEW.date_echeance, '+9 months'), NEW.id, 'planifie');
    END;

