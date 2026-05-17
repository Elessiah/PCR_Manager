use rusqlite::Connection;
use anyhow::{Result, Context};
use parking_lot::Mutex;
use tauri::Manager;
use keyring::Entry;
use uuid::Uuid;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

fn get_or_create_db_key() -> Result<String> {
    let entry = Entry::new("PCRManager", "db_encryption_key")
        .context("Failed to create keyring entry")?;

    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(_) => {
            let key = Uuid::new_v4().to_string();
            entry.set_password(&key)
                .context("Failed to store database key in keyring")?;
            Ok(key)
        }
    }
}

pub fn open_db(app_handle: &tauri::AppHandle) -> Result<Connection> {
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .context("Failed to resolve AppLocalData directory")?;

    std::fs::create_dir_all(&app_data_dir)
        .context("Failed to create AppData directory")?;

    let db_path = app_data_dir.join("pcr.db");

    let conn = Connection::open(&db_path)
        .context("Failed to open database connection")?;

    let db_key = get_or_create_db_key()?;
    let escaped_key = db_key.replace('\'', "''");
    conn.execute_batch(&format!("PRAGMA key = '{}';", escaped_key))?;

    Ok(conn)
}

/// Liste ordonnée des migrations à exécuter. Ajouter une nouvelle entrée
/// pour chaque fichier `Vn__*.sql` ; les versions déjà appliquées sont
/// détectées via la table `__migrations` et skippées.
const MIGRATIONS: &[(i32, &str, &str)] = &[
    (1, "V1__initial",   include_str!("../migrations/V1__initial.sql")),
    (2, "V2__seed_demo", include_str!("../migrations/V2__seed_demo.sql")),
    (3, "V3__competence_description", include_str!("../migrations/V3__competence_description.sql")),
    (4, "V4__appareil_competences",   include_str!("../migrations/V4__appareil_competences.sql")),
    (5, "V5__local_auth",             include_str!("../migrations/V5__local_auth.sql")),
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
            .with_context(|| format!("Failed to check migration {} status", label))?;

        if already_applied {
            continue;
        }

        conn.execute_batch(sql)
            .with_context(|| format!("Failed to execute migration {}", label))?;

        conn.execute(
            "INSERT INTO __migrations (version) VALUES (?1)",
            [version],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub async fn init_db(state: tauri::State<'_, DbState>) -> Result<(), String> {
    let mut conn = state.conn.lock();
    run_migrations(&mut conn)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // NOTE: get_or_create_db_key() non testée unitairement (effet de bord OS keyring)

    // Retourne (Connection, TempDir) : le TempDir doit rester en vie pendant
    // tout le test pour que SQLCipher puisse accéder aux fichiers WAL/shm.
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
            "controle_qualite",
            "document",
            "etablissement",
            "habilitation",
            "local_credential",
            "passkey",
            "travailleur",
            "verification_technique",
        ];

        assert_eq!(tables, expected_tables, "Tables mismatch");
    }

    #[test]
    fn test_competence_ref_seed_has_9_rows() {
        let (mut conn, _dir) = create_test_db().expect("Failed to create test DB");
        run_migrations(&mut conn).expect("Failed to run migrations");

        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM competence_ref")
            .expect("Failed to prepare statement");

        let count: i64 = stmt
            .query_row([], |row| row.get(0))
            .expect("Failed to query count");

        assert_eq!(count, 9, "competence_ref should have exactly 9 rows");
    }

    #[test]
    fn test_view_v_prochaine_verification_exists() {
        let (mut conn, _dir) = create_test_db().expect("Failed to create test DB");
        run_migrations(&mut conn).expect("Failed to run migrations");

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='v_prochaine_verification'")
            .expect("Failed to prepare statement");

        let exists = stmt
            .exists([])
            .expect("Failed to query view existence");

        assert!(exists, "View v_prochaine_verification should exist");
    }

    // NOTE: get_or_create_db_key() non testée unitairement (effet de bord OS keyring)
}
