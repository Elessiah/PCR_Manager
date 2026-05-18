-- ============================================================
-- V2 — Seed de démonstration
-- Objectif : couvrir les différents états UI (OK / proche échéance / expiré)
-- Référence temporelle : 2026-05-17
-- Idempotent : INSERT OR IGNORE sur clé id explicite.
-- En prod, ajouter une migration V3 qui purge ce seed.
-- ============================================================

-- ------------------------------------------------------------
-- ÉTABLISSEMENT id=1
-- ------------------------------------------------------------
INSERT OR IGNORE INTO etablissement
    (id, denomination, statut_juridique, siret, adresse, code_postal, ville,
     telephone, email, site_internet)
VALUES
    (1, 'Cabinet Cardio Démo', 'SARL', '12345678901234',
     '12 rue de la Cardiologie', '75008', 'Paris',
     '01 23 45 67 89', 'contact@cardio-demo.fr', 'https://cardio-demo.fr');

-- ------------------------------------------------------------
-- TRAVAILLEURS — 4 profils, 4 états distincts
--   1 - Sophie Martin   : tout à jour (statut vert)
--   2 - Lucas Dubois    : formation RP travailleurs + visite médicale proches
--   3 - Camille Leroy   : formation RP travailleurs et visite médicale expirées
--   4 - Thomas Bernard  : récemment embauché, formation patients non faite
-- ------------------------------------------------------------
INSERT OR IGNORE INTO travailleur
    (id, etablissement_id, nom, prenom, sexe, date_naissance,
     fonction, date_debut_activite, categorie_reglementaire,
     numero_adeli_rpps, email, telephone)
VALUES
    (1, 1, 'Martin',  'Sophie',  'F', '1978-03-15',
     'Cardiologue_liberal', '2008-09-01', 'B',
     '10001234567', 's.martin@cardio-demo.fr',  '06 12 34 56 78'),
    (2, 1, 'Dubois',  'Lucas',   'M', '1985-07-22',
     'MERM',               '2012-01-10', 'A',
     '20009876543', 'l.dubois@cardio-demo.fr',  '06 98 76 54 32'),
    (3, 1, 'Leroy',   'Camille', 'F', '1990-11-04',
     'Infirmier',          '2015-06-15', 'B',
     '30005551122', 'c.leroy@cardio-demo.fr',   '06 55 11 22 33'),
    (4, 1, 'Bernard', 'Thomas',  'M', '1988-04-09',
     'Cardiologue',        '2026-03-01', 'A',
     '40008887766', 't.bernard@cardio-demo.fr', '06 88 77 66 55');

-- ------------------------------------------------------------
-- HABILITATIONS
-- Cycles de renouvellement :
--   formation_rp_travailleurs : 3 ans
--   formation_rp_patients     : 7 ans
--   visite_medicale           : 1 an
--   dosimétrie                : renouvellement administratif annuel
-- ------------------------------------------------------------
INSERT OR IGNORE INTO habilitation
    (id, travailleur_id,
     dosimetrie_passive_date, dosimetrie_operationnelle_date,
     formation_rp_travailleurs_date, formation_rp_patients_date,
     visite_medicale_date)
VALUES
    -- Sophie : tout à jour
    (1, 1,
     '2026-01-15', '2026-01-15',
     '2024-02-10',  -- expire 2027-02 ✓
     '2022-05-20',  -- expire 2029-05 ✓
     '2026-03-10'), -- expire 2027-03 ✓

    -- Lucas : formation RP travailleurs (expire 2026-06-15, ~1 mois)
    --         visite médicale (expire 2026-06-20, ~1 mois)
    (2, 2,
     '2026-02-01', '2026-02-01',
     '2023-06-15',  -- expire 2026-06-15 ⚠ proche
     '2024-03-15',  -- expire 2031-03 ✓
     '2025-06-20'), -- expire 2026-06-20 ⚠ proche

    -- Camille : formation RP travailleurs expirée (2025-11), visite expirée (2025-09)
    --           dosimétrie opérationnelle non assignée, patients jamais faite
    (3, 3,
     '2025-12-10', NULL,
     '2022-11-08',  -- expire 2025-11-08 ✗ expiré
     NULL,          -- jamais réalisée ✗
     '2024-09-25'), -- expire 2025-09-25 ✗ expiré

    -- Thomas : nouvelle embauche (03/2026), formation patients à programmer
    (4, 4,
     '2026-03-15', '2026-03-15',
     '2025-01-20',  -- expire 2028-01 ✓
     NULL,          -- à programmer
     '2026-03-01'); -- expire 2027-03 ✓

-- ------------------------------------------------------------
-- APPAREILS (2 : coronarographie Fixe + C-arm Déplaçable)
-- ------------------------------------------------------------
INSERT OR IGNORE INTO appareil
    (id, etablissement_id, designation, marque, modele, numero_serie, type,
     annee_mise_en_service, lieu_utilisation, utilisation_partagee,
     tension_nominale_kv, intensite_maximale_ma)
VALUES
    (1, 1, 'Salle de coronarographie 1', 'Siemens', 'Artis Q', 'SN-AQ-2019-001',
     'Fixe', 2019, 'Bloc Cardio - Salle 1', 0, 125.0, 1000.0),
    (2, 1, 'C-arm mobile bloc', 'GE Healthcare', 'OEC Elite', 'SN-OEC-2021-007',
     'Deplacable', 2021, 'Bloc opératoire', 1, 110.0, 600.0);

-- ------------------------------------------------------------
-- VÉRIFICATIONS TECHNIQUES
-- Annuelle interne : période 1 an — triennale externe : 3 ans
-- Appareil 1 : annuelle OK (2025-11), triennale OK (2024-05, expire 2027-05)
-- Appareil 2 : annuelle proche (2025-06, expire 2026-06 ⚠), triennale OK (2024-11)
-- ------------------------------------------------------------
INSERT OR IGNORE INTO verification_technique
    (id, appareil_id, type, date_realisation, realise_par, organisme, observations)
VALUES
    (1, 1, 'annuelle_interne',  '2025-11-20', 'L. Dubois (PCR)', NULL,
     'RAS, conformité OK'),
    (2, 1, 'triennale_externe', '2024-05-15', NULL, 'APAVE',
     'Rapport n°APV-2024-1289 — conforme, prochain contrôle 2027-05'),
    (3, 2, 'annuelle_interne',  '2025-06-10', 'L. Dubois (PCR)', NULL,
     'RAS — prochain contrôle 2026-06 ⚠'),
    (4, 2, 'triennale_externe', '2024-11-08', NULL, 'Bureau Veritas',
     'Conforme, prochain contrôle 2027-11');

-- ------------------------------------------------------------
-- CONTRÔLES QUALITÉ
-- Le trigger trg_generer_cq_internes génère automatiquement
-- les 3 internes (J+90 / J+180 / J+270) pour chaque externe.
-- ------------------------------------------------------------
INSERT OR IGNORE INTO controle_qualite
    (id, appareil_id, type, date_realisation, date_echeance, organisme, statut)
VALUES
    (1, 1, 'externe', '2025-11-20', '2025-11-20', 'APAVE',          'realise'),
    (2, 2, 'externe', '2026-01-10', '2026-01-10', 'Bureau Veritas', 'realise');

-- ------------------------------------------------------------
-- COMPÉTENCES TRAVAILLEUR
-- Sophie (1) + Lucas (2) : compétences 1-4 validées sur appareil 1
-- Thomas (4) : compétences 1-2 validées sur appareil 1 (en cours de formation)
-- Appareil 2 : Lucas validé sur compétences 1-3
-- ------------------------------------------------------------
INSERT OR IGNORE INTO competence_travailleur
    (travailleur_id, appareil_id, competence_ref_id, date_validation, validated)
VALUES
    -- Sophie / appareil 1
    (1, 1, 1, '2025-09-15', 1),
    (1, 1, 2, '2025-09-15', 1),
    (1, 1, 3, '2025-09-15', 1),
    (1, 1, 4, '2025-09-15', 1),
    -- Lucas / appareil 1
    (2, 1, 1, '2025-10-01', 1),
    (2, 1, 2, '2025-10-01', 1),
    (2, 1, 3, '2025-10-01', 1),
    -- Thomas / appareil 1 (en cours)
    (4, 1, 1, '2026-03-20', 1),
    (4, 1, 2, '2026-03-20', 1),
    -- Lucas / appareil 2
    (2, 2, 1, '2025-10-15', 1),
    (2, 2, 2, '2025-10-15', 1),
    (2, 2, 3, '2025-10-15', 1);
