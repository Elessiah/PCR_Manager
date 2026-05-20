-- ============================================================
-- Seed de démonstration — ne pas exécuter en production
-- Objectif : couvrir les différents états UI (OK / proche échéance / expiré)
-- ============================================================

INSERT OR IGNORE INTO etablissement
    (id, denomination, statut_juridique, siret, adresse, code_postal, ville,
     telephone, email, site_internet)
VALUES
    (1, 'Cabinet Cardio Démo', 'SARL', '12345678901234',
     '12 rue de la Cardiologie', '75008', 'Paris',
     '01 23 45 67 89', 'contact@cardio-demo.fr', 'https://cardio-demo.fr');

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

INSERT OR IGNORE INTO habilitation
    (id, travailleur_id,
     dosimetrie_passive_date, dosimetrie_operationnelle_date,
     formation_rp_travailleurs_date, formation_rp_patients_date,
     visite_medicale_date)
VALUES
    (1, 1, '2026-01-15', '2026-01-15', '2024-02-10', '2022-05-20', '2026-03-10'),
    (2, 2, '2026-02-01', '2026-02-01', '2023-06-15', '2024-03-15', '2025-06-20'),
    (3, 3, '2025-12-10', NULL,         '2022-11-08', NULL,          '2024-09-25'),
    (4, 4, '2026-03-15', '2026-03-15', '2025-01-20', NULL,          '2026-03-01');

INSERT OR IGNORE INTO appareil
    (id, etablissement_id, designation, marque, modele, numero_serie, type,
     annee_mise_en_service, lieu_utilisation, utilisation_partagee,
     tension_nominale_kv, intensite_maximale_ma)
VALUES
    (1, 1, 'Salle de coronarographie 1', 'Siemens', 'Artis Q', 'SN-AQ-2019-001',
     'Fixe', 2019, 'Bloc Cardio - Salle 1', 0, 125.0, 1000.0),
    (2, 1, 'C-arm mobile bloc', 'GE Healthcare', 'OEC Elite', 'SN-OEC-2021-007',
     'Deplacable', 2021, 'Bloc opératoire', 1, 110.0, 600.0);

INSERT OR IGNORE INTO verification_technique
    (id, appareil_id, type, date_realisation, realise_par, organisme, observations)
VALUES
    (1, 1, 'annuelle_interne',  '2025-11-20', 'L. Dubois (PCR)', NULL,
     'RAS, conformité OK'),
    (2, 1, 'triennale_externe', '2024-05-15', NULL, 'APAVE',
     'Rapport n°APV-2024-1289 — conforme, prochain contrôle 2027-05'),
    (3, 2, 'annuelle_interne',  '2025-06-10', 'L. Dubois (PCR)', NULL,
     'RAS — prochain contrôle 2026-06'),
    (4, 2, 'triennale_externe', '2024-11-08', NULL, 'Bureau Veritas',
     'Conforme, prochain contrôle 2027-11');

INSERT OR IGNORE INTO controle_qualite
    (id, appareil_id, type, date_realisation, date_echeance, organisme, statut)
VALUES
    (1, 1, 'externe', '2025-11-20', '2025-11-20', 'APAVE',          'realise'),
    (2, 2, 'externe', '2026-01-10', '2026-01-10', 'Bureau Veritas', 'realise');

INSERT OR IGNORE INTO competence_travailleur
    (travailleur_id, appareil_id, competence_ref_id, date_validation, validated)
VALUES
    (1, 1, 1, '2025-09-15', 1),
    (1, 1, 2, '2025-09-15', 1),
    (1, 1, 3, '2025-09-15', 1),
    (1, 1, 4, '2025-09-15', 1),
    (2, 1, 1, '2025-10-01', 1),
    (2, 1, 2, '2025-10-01', 1),
    (2, 1, 3, '2025-10-01', 1),
    (4, 1, 1, '2026-03-20', 1),
    (4, 1, 2, '2026-03-20', 1),
    (2, 2, 1, '2025-10-15', 1),
    (2, 2, 2, '2025-10-15', 1),
    (2, 2, 3, '2025-10-15', 1);
