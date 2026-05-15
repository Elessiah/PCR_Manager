# Base de données

## Aperçu

La base de données PCR Manager est une base SQLite chiffrée via **SQLCipher** avec AES-256. Le fichier `pcr.db` est stocké dans le répertoire local de l'application (`AppLocalDataDir`), résolu dynamiquement selon la plateforme (Windows : `AppData/PCR Manager/`, macOS : équivalent standard). L'accès à la connexion est synchronisé via un `Mutex`.

Les PRAGMA essentiels sont activés au schéma :
- `PRAGMA foreign_keys = ON` : applique les contraintes de clés étrangères
- `PRAGMA journal_mode = WAL` : Write-Ahead Logging pour performance et concurrence

## Migrations

Les migrations sont gérées via `run_migrations()` (db.rs ligne 29), qui exécute le fichier `src-tauri/migrations/V1__initial.sql` lors du premier démarrage. Un suivi est maintenu dans la table `__migrations`, empêchant les ré-exécutions.

## Tables

### passkey

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| credential_id | TEXT | NOT NULL UNIQUE | Identifiant WebAuthn |
| public_key | BLOB | NOT NULL | Clé publique du credential |
| sign_count | INTEGER | NOT NULL DEFAULT 0 | Compteur de signature |
| label | TEXT | | Étiquette optionnelle (ex: "MacBook de papa") |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de création |
| last_used_at | TEXT | | Timestamp de dernière utilisation |

Stocke un credential Passkey unique pour l'authentification de l'utilisateur.

### etablissement

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| denomination | TEXT | NOT NULL | Nom de l'établissement |
| statut_juridique | TEXT | | Forme juridique |
| siret | TEXT | CHECK(length = 14) | SIRET (14 chiffres) |
| adresse | TEXT | | Adresse physique |
| code_postal | TEXT | | Code postal |
| ville | TEXT | | Ville |
| telephone | TEXT | | Numéro de téléphone |
| email | TEXT | | Adresse e-mail |
| site_internet | TEXT | | URL du site web |
| kbis_chemin | TEXT | | Chemin relatif du K-bis |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de création |
| updated_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de mise à jour |

Représente un établissement géré par l'utilisateur, avec ses informations de contact et documents.

### travailleur

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| etablissement_id | INTEGER | NOT NULL REFERENCES etablissement(id) ON DELETE CASCADE | Établissement rattaché |
| nom | TEXT | NOT NULL | Nom |
| prenom | TEXT | NOT NULL | Prénom |
| sexe | TEXT | CHECK(IN ('M', 'F', 'Autre')) | Sexe |
| date_naissance | TEXT | | Date de naissance |
| lieu_naissance | TEXT | | Lieu de naissance |
| pays_naissance | TEXT | | Pays de naissance |
| fonction | TEXT | CHECK(IN ('Cardiologue', 'Cardiologue_liberal', 'MERM', 'Infirmier')) | Fonction professionnelle |
| date_debut_activite | TEXT | | Date de début d'activité |
| categorie_reglementaire | TEXT | CHECK(IN ('A', 'B')) | Catégorie réglementaire |
| numero_adeli_rpps | TEXT | | Numéro ADELI/RPPS |
| email | TEXT | | Adresse e-mail |
| telephone | TEXT | | Numéro de téléphone |
| numero_securite_sociale | TEXT | | Numéro de sécurité sociale (sensible) |
| numero_porteur_dosimetrie_passive | TEXT | | Numéro de porteur dosimétrie passive (sensible) |
| numero_suivi_medical | TEXT | | Numéro de suivi médical (sensible) |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de création |
| updated_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de mise à jour |

Professionnel rattaché à un établissement. Les colonnes sensibles (SSN, dosimétrie, suivi médical) sont chiffrées au niveau fichier par SQLCipher.

### habilitation

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| travailleur_id | INTEGER | NOT NULL UNIQUE REFERENCES travailleur(id) ON DELETE CASCADE | Travailleur (1:1) |
| dosimetrie_passive_date | TEXT | | Date de dosimétrie passive |
| dosimetrie_operationnelle_date | TEXT | | Date de dosimétrie opérationnelle |
| formation_rp_travailleurs_date | TEXT | | Date de formation (renouvellement 3 ans) |
| formation_rp_patients_date | TEXT | | Date de formation patients (renouvellement 7 ans) |
| visite_medicale_date | TEXT | | Date de visite médicale |
| updated_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de mise à jour |

Synthétise les autorisations d'un travailleur. Le statut (valide, expirant, expiré) est calculé dynamiquement ; seules les dates de complétion sont stockées.

### competence_ref

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| libelle | TEXT | NOT NULL | Intitulé de la compétence |
| ordre | INTEGER | NOT NULL UNIQUE | Ordre d'affichage |

Référentiel des 9 compétences de base, pré-peuplé au démarrage. Valeurs :
1. Mise sous tension de l'appareil
2. Mise en marche de l'appareil
3. Enregistrement patient (vérification identité)
4. Détection patients à risque
5. Compétence 5
6. Compétence 6
7. Compétence 7
8. Compétence 8
9. Compétence 9

### appareil

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| etablissement_id | INTEGER | NOT NULL REFERENCES etablissement(id) ON DELETE CASCADE | Établissement propriétaire |
| designation | TEXT | NOT NULL | Nom de l'appareil |
| marque | TEXT | | Marque fabricante |
| modele | TEXT | | Modèle |
| numero_serie | TEXT | | Numéro de série |
| type | TEXT | CHECK(IN ('Fixe', 'Deplacable')) | Type (fixe ou déplaçable) |
| annee_mise_en_service | INTEGER | | Année de mise en service |
| lieu_utilisation | TEXT | | Localisation |
| utilisation_partagee | INTEGER | NOT NULL DEFAULT 0 CHECK(IN (0, 1)) | Utilisé par plusieurs travailleurs |
| tension_nominale_kv | REAL | | Tension nominale (kV) |
| intensite_maximale_ma | REAL | | Intensité maximale (mA) |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de création |
| updated_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de mise à jour |

Équipement radiologique rattaché à un établissement, avec caractéristiques techniques.

### competence_travailleur

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| travailleur_id | INTEGER | NOT NULL REFERENCES travailleur(id) ON DELETE CASCADE | Travailleur |
| appareil_id | INTEGER | NOT NULL REFERENCES appareil(id) ON DELETE CASCADE | Appareil |
| competence_ref_id | INTEGER | NOT NULL REFERENCES competence_ref(id) | Compétence |
| date_validation | TEXT | | Date de validation |
| validated | INTEGER | NOT NULL DEFAULT 0 CHECK(IN (0, 1)) | État de validation (0/1) |
| UNIQUE(travailleur_id, appareil_id, competence_ref_id) | | | |

Validation de compétence : un travailleur valide une compétence sur un appareil donné.

### verification_technique

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| appareil_id | INTEGER | NOT NULL REFERENCES appareil(id) ON DELETE CASCADE | Appareil inspecté |
| type | TEXT | NOT NULL CHECK(IN ('annuelle_interne', 'triennale_externe')) | Type de vérification |
| date_realisation | TEXT | NOT NULL | Date d'exécution |
| realise_par | TEXT | | Responsable de l'inspection |
| organisme | TEXT | | Organisme certificateur |
| observations | TEXT | | Notes d'inspection |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de création |

Vérifie l'état technique annuel (interne) ou triennal (externe) d'un appareil.

### controle_qualite

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| appareil_id | INTEGER | NOT NULL REFERENCES appareil(id) ON DELETE CASCADE | Appareil contrôlé |
| type | TEXT | NOT NULL CHECK(IN ('externe', 'partiel_interne', 'complet_interne')) | Type de contrôle |
| date_realisation | TEXT | | Date d'exécution (NULL si planifié) |
| date_echeance | TEXT | NOT NULL | Date cible |
| controle_externe_id | INTEGER | REFERENCES controle_qualite(id) | Contrôle parent (pour internes) |
| organisme | TEXT | | Organisme testeur |
| realise_par | TEXT | | Responsable |
| statut | TEXT | NOT NULL DEFAULT 'planifie' CHECK(IN ('planifie', 'realise', 'en_retard')) | État |
| observations | TEXT | | Observations |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp de création |

Contrôle de qualité avec suivi de l'état. Insertion d'un contrôle `externe` déclenche le trigger `trg_generer_cq_internes`.

### document

| Nom | Type | Contraintes | Description |
|-----|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| entity_type | TEXT | NOT NULL CHECK(IN ('etablissement', 'travailleur', 'appareil')) | Type d'entité |
| entity_id | INTEGER | NOT NULL | Identifiant de l'entité |
| type_document | TEXT | NOT NULL | Classification (ex: 'kbis', 'formation', 'controle') |
| nom_fichier | TEXT | NOT NULL | Nom du fichier |
| chemin_relatif | TEXT | NOT NULL | Chemin relatif dans AppData |
| uploaded_at | TEXT | NOT NULL DEFAULT (datetime('now')) | Timestamp d'ajout |

Indexe les documents téléchargés (PDFs, certifications, etc.) avec chemins relatifs au répertoire de l'application.

## Vues

### v_prochaine_verification

Expose les échéances de vérification technique par appareil et type :

```sql
SELECT
    vt.appareil_id,
    vt.type,
    MAX(vt.date_realisation) AS derniere_date,
    CASE vt.type
        WHEN 'annuelle_interne'   THEN date(MAX(vt.date_realisation), '+1 year')
        WHEN 'triennale_externe'  THEN date(MAX(vt.date_realisation), '+3 years')
    END AS prochaine_echeance
FROM verification_technique vt
GROUP BY vt.appareil_id, vt.type
```

Champs : `appareil_id`, `type`, `derniere_date`, `prochaine_echeance`.

## Triggers

### Mise à jour automatique de `updated_at`

Quatre triggers maintiennent l'horodatage ISO 8601 sur UPDATE :

```sql
CREATE TRIGGER trg_etablissement_updated
    AFTER UPDATE ON etablissement
    BEGIN
        UPDATE etablissement SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER trg_travailleur_updated
    AFTER UPDATE ON travailleur
    BEGIN
        UPDATE travailleur SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER trg_appareil_updated
    AFTER UPDATE ON appareil
    BEGIN
        UPDATE appareil SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER trg_habilitation_updated
    AFTER UPDATE ON habilitation
    BEGIN
        UPDATE habilitation SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
```

### Génération automatique des contrôles qualité internes

À l'insertion d'un contrôle `externe`, le trigger `trg_generer_cq_internes` crée trois contrôles `partiel_interne` et `complet_interne` aux écheances J+90, J+180, J+270 :

```sql
CREATE TRIGGER trg_generer_cq_internes
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
```

## Conventions

**Dates** — Format ISO 8601 en TEXT (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:MM:SSZ`). Générées via `datetime('now')`.

**Booléens** — Représentés par INTEGER 0 (faux) ou 1 (vrai), validés par CHECK.

**Clés primaires** — `INTEGER PRIMARY KEY AUTOINCREMENT` sur toutes les tables.

**Clés étrangères** — `ON DELETE CASCADE` systématique pour les entités enfants (travailleur → établissement, appareil → établissement, etc.). Seul `controle_externe_id` dans `controle_qualite` est sans CASCADE (auto-référence optionnelle).

## Seed

La table `competence_ref` est pré-peuplée avec 9 compétences à l'initialisation :
1. Mise sous tension de l'appareil
2. Mise en marche de l'appareil
3. Enregistrement patient (vérification identité)
4. Détection patients à risque
5. Compétence 5 à 9 (libellés génériques)

## Chiffrement

La base est sécurisée via **SQLCipher** avec AES-256. La clé est définie à l'ouverture de la connexion (`db.rs` ligne 24) via `PRAGMA key = 'CHANGEME_DEV_KEY'`. En production, cette clé doit être dérivée depuis les credentials de l'utilisateur (voir [security.md](./security.md) pour les détails d'authentification Passkey et dérivation de clé).

Les données sensibles de la table `travailleur` (SSN, numéros de dosimétrie, suivi médical) sont chiffrées au niveau du fichier `.db` par SQLCipher ; aucun chiffrement applicatif supplémentaire n'est requis.

## Liens

- [backend.md](./backend.md) — Commandes Tauri et opérations de base de données
- [security.md](./security.md) — Authentification Passkey, gestion des clés, conformité
