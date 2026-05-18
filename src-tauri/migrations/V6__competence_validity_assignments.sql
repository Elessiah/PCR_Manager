-- 1. Étendre competence_ref
ALTER TABLE competence_ref ADD COLUMN propre_appareil INTEGER NOT NULL DEFAULT 1 CHECK(propre_appareil IN (0,1));
ALTER TABLE competence_ref ADD COLUMN duree_validite_mois INTEGER;
ALTER TABLE competence_ref ADD COLUMN duree_alerte_mois INTEGER NOT NULL DEFAULT 3;

-- 2. Étendre competence_travailleur
ALTER TABLE competence_travailleur ADD COLUMN date_peremption TEXT;

-- 3. Étendre habilitation
ALTER TABLE habilitation ADD COLUMN visite_medicale_date_peremption TEXT;
ALTER TABLE habilitation ADD COLUMN visite_medicale_duree_mois INTEGER;

-- 4. Nouvelle table travailleur_appareil (assignation souple)
CREATE TABLE IF NOT EXISTS travailleur_appareil (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER NOT NULL REFERENCES travailleur(id) ON DELETE CASCADE,
  appareil_id INTEGER NOT NULL REFERENCES appareil(id) ON DELETE CASCADE,
  UNIQUE(travailleur_id, appareil_id)
);
CREATE INDEX IF NOT EXISTS idx_ta_travailleur ON travailleur_appareil(travailleur_id);

-- 5. Nouvelle table competence_travailleur_general (compétences générales)
CREATE TABLE IF NOT EXISTS competence_travailleur_general (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  travailleur_id INTEGER NOT NULL REFERENCES travailleur(id) ON DELETE CASCADE,
  competence_ref_id INTEGER NOT NULL REFERENCES competence_ref(id) ON DELETE CASCADE,
  date_validation TEXT,
  date_peremption TEXT,
  validated INTEGER NOT NULL DEFAULT 0 CHECK(validated IN (0,1)),
  UNIQUE(travailleur_id, competence_ref_id)
);
CREATE INDEX IF NOT EXISTS idx_ctg_travailleur ON competence_travailleur_general(travailleur_id);
