use rusqlite::Connection;
use std::path::PathBuf;
use anyhow::{Result, Context};
use parking_lot::Mutex;
use tauri::Manager;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn open_db(app_handle: &tauri::AppHandle) -> Result<Connection> {
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .context("Failed to resolve AppLocalData directory")?;

    std::fs::create_dir_all(&app_data_dir)
        .context("Failed to create AppData directory")?;

    let db_path = app_data_dir.join("pcr.db");

    let mut conn = Connection::open(&db_path)
        .context("Failed to open database connection")?;

    conn.execute_batch("PRAGMA key = 'CHANGEME_DEV_KEY';")?;

    Ok(conn)
}

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    // Create migrations tracking table if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS __migrations (version INTEGER PRIMARY KEY)",
        [],
    )?;

    // Check if V1 has already been applied
    let mut stmt = conn.prepare("SELECT 1 FROM __migrations WHERE version = 1")?;
    let already_migrated: bool = stmt
        .exists([])
        .context("Failed to check migration status")?;

    if already_migrated {
        return Ok(());
    }

    // Execute migration
    let sql = include_str!("../migrations/V1__initial.sql");
    conn.execute_batch(sql)
        .context("Failed to execute migration V1")?;

    // Mark V1 as applied
    conn.execute("INSERT INTO __migrations (version) VALUES (1)", [])?;

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

    fn create_test_db() -> Result<Connection> {
        let dir = tempfile::tempdir()?;
        let db_path = dir.path().join("test.db");
        let mut conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA key = 'test-key';")?;
        Ok(conn)
    }

    #[test]
    fn test_migrations_create_expected_tables() {
        let mut conn = create_test_db().expect("Failed to create test DB");
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
            "competence_ref",
            "competence_travailleur",
            "controle_qualite",
            "document",
            "etablissement",
            "habilitation",
            "passkey",
            "travailleur",
            "verification_technique",
        ];

        assert_eq!(tables, expected_tables, "Tables mismatch");
    }

    #[test]
    fn test_competence_ref_seed_has_9_rows() {
        let mut conn = create_test_db().expect("Failed to create test DB");
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
        let mut conn = create_test_db().expect("Failed to create test DB");
        run_migrations(&mut conn).expect("Failed to run migrations");

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='v_prochaine_verification'")
            .expect("Failed to prepare statement");

        let exists = stmt
            .exists([])
            .expect("Failed to query view existence");

        assert!(exists, "View v_prochaine_verification should exist");
    }
}
