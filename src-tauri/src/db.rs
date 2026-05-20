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
        Err(_) => {
            let key = Uuid::new_v4().to_string();
            entry
                .set_password(&key)
                .context("Failed to store database key in keyring")?;
            Ok(key)
        }
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
pub fn open_and_migrate(app: &tauri::AppHandle, key: Option<&str>) -> Result<Connection> {
    let mut conn = match key {
        Some(k) => open_db_with_key(app, k)?,
        None    => open_db_keyring(app)?,
    };
    run_migrations(&mut conn)?;
    Ok(conn)
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-keying (lors du premier appairage iPhone en mode v2)
// ─────────────────────────────────────────────────────────────────────────────

/// Modifie la clé SQLCipher de la connexion ouverte.
/// La connexion reste valide après l'appel.
pub fn rekey_db(conn: &Connection, new_key: &str) -> Result<()> {
    let escaped = new_key.replace('\'', "''");
    conn.execute_batch(&format!("PRAGMA rekey = '{}';", escaped))
        .context("PRAGMA rekey échoué")?;
    Ok(())
}

/// Génère une clé DB aléatoire (32 octets → 64 chars hex).
pub fn generate_db_key() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Migrations
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATIONS: &[(i32, &str, &str)] = &[
    (1, "V1__initial",   include_str!("../migrations/V1__initial.sql")),
    (2, "V2__seed_demo", include_str!("../migrations/V2__seed_demo.sql")),
    (3, "V3__competence_description", include_str!("../migrations/V3__competence_description.sql")),
    (4, "V4__appareil_competences",   include_str!("../migrations/V4__appareil_competences.sql")),
    (6, "V6__competence_validity_assignments", include_str!("../migrations/V6__competence_validity_assignments.sql")),
    (9, "V9__journal_acces",          include_str!("../migrations/V9__journal_acces.sql")),
    (10, "V10__registre_traitement",  include_str!("../migrations/V10__registre_traitement.sql")),
];

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS __migrations (version INTEGER PRIMARY KEY)",
        [],
    )?;

    for (version, label, sql) in MIGRATIONS {
        let already_applied: bool = conn
            .prepare("SELECT 1 FROM __migrations WHERE version = ?1")?
            .exists([version])
            .with_context(|| format!("Impossible de vérifier la migration {}", label))?;

        if already_applied {
            continue;
        }

        conn.execute_batch(sql)
            .with_context(|| format!("Échec de la migration {}", label))?;

        conn.execute(
            "INSERT INTO __migrations (version) VALUES (?1)",
            [version],
        )?;
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
            "__migrations",
            "appareil",
            "appareil_competence_ref",
            "competence_ref",
            "competence_travailleur",
            "competence_travailleur_general",
            "controle_qualite",
            "document",
            "etablissement",
            "habilitation",
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
