-- CNIL registre des traitements -- base legale NIR (numero de securite sociale)
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