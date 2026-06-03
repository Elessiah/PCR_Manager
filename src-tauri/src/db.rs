use rusqlite::Connection;
use anyhow::{Result, Context};
use parking_lot::{Mutex, MutexGuard, MappedMutexGuard};
use tauri::Manager;
use keyring::Entry;
use uuid::Uuid;
use std::path::PathBuf;

pub struct DbState {
    pub conn: Mutex<Option<Connection>>,
}

impl DbState {
    /// Retourne un guard vers la connexion active.
    /// Erreur si la DB n'est pas encore ouverte (auth iPhone requise).
    pub fn get(&self) -> Result<MappedMutexGuard<'_, Connection>, String> {
        let guard = self.conn.lock();
        if guard.is_none() {
            return Err(
                "Base de données non disponible : authentification requise".into(),
            );
        }
        Ok(MutexGuard::map(guard, |opt| opt.as_mut().unwrap()))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chemins de fichiers
// ─────────────────────────────────────────────────────────────────────────────

fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

/// Chemin du bundle ECIES Mac Keychain.
pub fn mac_wrapped_key_path(app: &tauri::AppHandle) -> PathBuf {
    app_data_dir(app).join("mac_wrapped_db_key.bin")
}

/// Vrai si le bundle Mac Keychain existe (mode Mac Keychain activé).
pub fn has_mac_wrapped_key(app: &tauri::AppHandle) -> bool {
    mac_wrapped_key_path(app).exists()
}

// ─────────────────────────────────────────────────────────────────────────────
// Gestion de la clé DB (keyring OS — mode legacy et mode TOTP)
// ─────────────────────────────────────────────────────────────────────────────

fn get_or_create_db_key() -> Result<String> {
    let entry = Entry::new("PCRManager", "db_encryption_key")
        .context("Failed to create keyring entry")?;

    match entry.get_password() {
        Ok(password) => Ok(password),
        // Entrée absente → première installation, on génère une clé fraîche.
        Err(keyring::Error::NoEntry) => {
            let key = Uuid::new_v4().to_string();
            entry
                .set_password(&key)
                .context("Failed to store database key in keyring")?;
            Ok(key)
        }
        // Toute autre erreur (service indisponible, accès refusé…) est fatale :
        // générer une nouvelle clé écraserait silencieusement l'ancienne.
        Err(e) => Err(anyhow::anyhow!("Impossible d'accéder au keyring: {e}")),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ouverture de la connexion SQLCipher
// ─────────────────────────────────────────────────────────────────────────────

/// Ouvre la DB avec une clé explicite (mode iPhone).
pub fn open_db_with_key(app: &tauri::AppHandle, key: &str) -> Result<Connection> {
    let dir = app_data_dir(app);
    std::fs::create_dir_all(&dir).context("Impossible de créer le dossier AppData")?;

    let conn = Connection::open(dir.join("pcr.db"))
        .context("Impossible d'ouvrir la connexion SQLCipher")?;

    let escaped = key.replace('\'', "''");
    conn.execute_batch(&format!("PRAGMA key = '{}';", escaped))
        .context("PRAGMA key échoué")?;

    Ok(conn)
}

/// Ouvre la DB avec la clé stockée dans le keyring (mode legacy).
pub fn open_db_keyring(app: &tauri::AppHandle) -> Result<Connection> {
    let key = get_or_create_db_key()?;
    open_db_with_key(app, &key)
}

/// Ouvre la DB et exécute les migrations en attente.
/// `key` = None → mode legacy (keyring), Some(k) → clé fournie par iPhone.
/// Si la clé ne correspond pas à la DB existante (SQLITE_NOTADB), supprime
/// la DB corrompue/inaccessible et recrée une DB vierge avec la clé actuelle.
pub fn open_and_migrate(app: &tauri::AppHandle, key: Option<&str>) -> Result<Connection> {
    let mut conn = match key {
        Some(k) => open_db_with_key(app, k)?,
        None    => open_db_keyring(app)?,
    };
    if let Err(e) = run_migrations(&mut conn) {
        let is_wrong_key = e.to_string().contains("not a database")
            || e.to_string().contains("SQLITE_NOTADB");
        if is_wrong_key {
            // La clé du keyring ne correspond plus à la DB (credential perdu/réinitialisé).
            // La DB existante est irrécouvrable : on la supprime et on repart à zéro.
            drop(conn);
            let db_path = app_data_dir(app).join("pcr.db");
            let _ = std::fs::remove_file(&db_path);
            let mut fresh_conn = match key {
                Some(k) => open_db_with_key(app, k)?,
                None    => open_db_keyring(app)?,
            };
            run_migrations(&mut fresh_conn)?;
            return Ok(fresh_conn);
        }
        return Err(e);
    }
    Ok(conn)
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-keying (lors du premier appairage iPhone en mode v2)
// ─────────────────────────────────────────────────────────────────────────────

/// Modifie la clé SQLCipher de la connexion ouverte.
/// La connexion reste valide après l'appel.
#[cfg(target_os = "macos")]
pub fn rekey_db(conn: &Connection, new_key: &str) -> Result<()> {
    let escaped = new_key.replace('\'', "''");
    conn.execute_batch(&format!("PRAGMA rekey = '{}';", escaped))
        .context("PRAGMA rekey échoué")?;
    Ok(())
}

/// Génère une clé DB aléatoire (32 octets → 64 chars hex).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn generate_db_key() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Schéma
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA: &str = include_str!("schema.sql");
#[cfg(debug_assertions)]
const SEED_DEMO: &str = include_str!("seed_demo.sql");

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)
        .map_err(|e| anyhow::anyhow!("Échec de l'initialisation du schéma: {e}"))?;

    // Migration 1 : ajoute ON DELETE CASCADE sur competence_travailleur.competence_ref_id
    // SQLite ne supporte pas ALTER COLUMN : on recrée la table dans une transaction.
    let user_version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap_or(0);

    if user_version < 1 {
        let tx = conn.transaction().context("Migration 1 : begin")?;
        tx.execute_batch(
            "DROP TABLE IF EXISTS competence_travailleur_v2;
             CREATE TABLE competence_travailleur_v2 (
                 id                INTEGER PRIMARY KEY AUTOINCREMENT,
                 travailleur_id    INTEGER NOT NULL REFERENCES travailleur(id)    ON DELETE CASCADE,
                 appareil_id       INTEGER NOT NULL REFERENCES appareil(id)       ON DELETE CASCADE,
                 competence_ref_id INTEGER NOT NULL REFERENCES competence_ref(id) ON DELETE CASCADE,
                 date_validation   TEXT,
                 validated         INTEGER NOT NULL DEFAULT 0 CHECK(validated IN (0, 1)),
                 date_peremption   TEXT,
                 UNIQUE(travailleur_id, appareil_id, competence_ref_id)
             );
             INSERT INTO competence_travailleur_v2 SELECT * FROM competence_travailleur;
             DROP TABLE competence_travailleur;
             ALTER TABLE competence_travailleur_v2 RENAME TO competence_travailleur;
             CREATE INDEX IF NOT EXISTS idx_ct_travailleur ON competence_travailleur(travailleur_id);",
        )
        .context("Migration 1 : recréation de competence_travailleur avec ON DELETE CASCADE")?;
        tx.pragma_update(None, "user_version", 1i64)
            .context("Migration 1 : user_version")?;
        tx.commit().context("Migration 1 : commit")?;
    }

    if user_version < 2 {
        let tx = conn.transaction().context("Migration 2 : begin")?;
        // ALTER TABLE ADD COLUMN échoue si la colonne existe déjà (nouvelles installs via schema.sql).
        // On ignore ces erreurs silencieusement.
        for col in &[
            "delai_alerte_dosimetrie_passive",
            "delai_alerte_dosimetrie_op",
            "delai_alerte_formation_rp_trav",
            "delai_alerte_formation_rp_pat",
            "delai_alerte_visite_med",
        ] {
            let _ = tx.execute_batch(&format!(
                "ALTER TABLE habilitation ADD COLUMN {} INTEGER", col
            ));
        }
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS habilitation_config (
                 item_type         TEXT    PRIMARY KEY,
                 delai_alerte_mois INTEGER NOT NULL
             );
             INSERT OR IGNORE INTO habilitation_config (item_type, delai_alerte_mois) VALUES
                 ('dosimetrie_passive',        1),
                 ('dosimetrie_operationnelle', 1),
                 ('formation_rp_travailleur',  1),
                 ('formation_rp_patient',      1),
                 ('visite_medicale',           3);",
        )
        .context("Migration 2 : table habilitation_config")?;
        tx.pragma_update(None, "user_version", 2i64)
            .context("Migration 2 : user_version")?;
        tx.commit().context("Migration 2 : commit")?;
    }

    // Production : garantit qu'une ligne établissement id=1 existe (requise par FirstSetupModal).
    // Non exécuté en debug car le seed_demo insère lui-même la ligne avec INSERT OR IGNORE.
    #[cfg(not(debug_assertions))]
    conn.execute_batch(
        "INSERT OR IGNORE INTO etablissement (id, denomination) VALUES (1, '');",
    )
    .context("Initialisation établissement id=1")?;

    #[cfg(debug_assertions)]
    {
        let is_empty = conn
            .query_row("SELECT COUNT(*) FROM etablissement", [], |r| r.get::<_, i64>(0))
            .unwrap_or(0) == 0;
        if is_empty {
            conn.execute_batch(SEED_DEMO).context("Échec du seed de démonstration")?;
        }
    }
    Ok(())
}

pub fn log_acces(conn: &Connection, operation: &str, entite: &str, entite_id: Option<i64>, champ_nir: bool) {
    let _ = conn.execute(
        "INSERT INTO journal_acces (operation, entite, entite_id, champ_nir) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![operation, entite, entite_id, if champ_nir { 1i64 } else { 0i64 }],
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Commande Tauri
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn init_db(state: tauri::State<'_, DbState>) -> Result<(), String> {
    let mut conn = state.get()?;
    run_migrations(&mut conn).map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Result<(Connection, tempfile::TempDir)> {
        let dir = tempfile::tempdir()?;
        let db_path = dir.path().join("test.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA key = 'test-key';")?;
        Ok((conn, dir))
    }

    #[test]
    fn test_migrations_create_expected_tables() {
        let (mut conn, _dir) = create_test_db().expect("Failed to create test DB");
        run_migrations(&mut conn).expect("Failed to run migrations");

        let mut stmt = conn
            .prepare(
                "SELECT name FROM sqlite_master \
                 WHERE type='table' AND name NOT LIKE 'sqlite_%' \
                 ORDER BY name",
            )
            .expect("Failed to prepare statement");

        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .expect("Failed to query tables")
            .filter_map(|r| r.ok())
            .collect();

        let expected_tables = vec![
            "appareil",
            "appareil_competence_ref",
            "competence_ref",
            "competence_travailleur",
            "competence_travailleur_general",
            "controle_qualite",
            "document",
            "etablissement",
            "habilitation",
            "habilitation_config",
            "journal_acces",
            "registre_traitement",
            "travailleur",
            "travailleur_appareil",
            "verification_technique",
        ];

        assert_eq!(tables, expected_tables, "Tables mismatch");
    }

    #[test]
    fn test_competence_ref_seed_has_9_rows() {
        let (mut conn, _dir) = create_test_db().expect("Failed to create test DB");
        run_migrations(&mut conn).expect("Failed to run migrations");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM competence_ref", [], |row| row.get(0))
            .expect("Failed to query count");

        assert_eq!(count, 9, "competence_ref should have exactly 9 rows");
    }

    #[test]
    fn test_view_v_prochaine_verification_exists() {
        let (mut conn, _dir) = create_test_db().expect("Failed to create test DB");
        run_migrations(&mut conn).expect("Failed to run migrations");

        let exists = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='v_prochaine_verification'")
            .expect("prepare")
            .exists([])
            .expect("exists");

        assert!(exists, "View v_prochaine_verification should exist");
    }

    #[test]
    fn test_generate_db_key_is_64_hex_chars() {
        let key = generate_db_key();
        assert_eq!(key.len(), 64);
        assert!(key.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_generate_db_key_is_random() {
        let k1 = generate_db_key();
        let k2 = generate_db_key();
        assert_ne!(k1, k2);
    }

    #[test]
    fn test_dbstate_get_returns_err_when_none() {
        let state = DbState { conn: Mutex::new(None) };
        assert!(state.get().is_err());
    }
}
