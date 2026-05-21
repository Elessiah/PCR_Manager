use crate::db::DbState;
use crate::models::Appareil;
use crate::auth_totp;

#[tauri::command]
pub async fn appareil_list(session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<Appareil>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, etablissement_id, designation, marque, modele, numero_serie, type, annee_mise_en_service, lieu_utilisation, utilisation_partagee, tension_nominale_kv, intensite_maximale_ma, created_at, updated_at FROM appareil ORDER BY id")
        .map_err(|e| e.to_string())?;

    let appareils = stmt
        .query_map([], |row| {
            Ok(Appareil {
                id: row.get(0)?,
                etablissement_id: row.get(1)?,
                designation: row.get(2)?,
                marque: row.get(3)?,
                modele: row.get(4)?,
                numero_serie: row.get(5)?,
                type_: row.get(6)?,
                annee_mise_en_service: row.get(7)?,
                lieu_utilisation: row.get(8)?,
                utilisation_partagee: row.get(9)?,
                tension_nominale_kv: row.get(10)?,
                intensite_maximale_ma: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(appareils)
}

#[tauri::command]
pub async fn appareil_get(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Appareil, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, etablissement_id, designation, marque, modele, numero_serie, type, annee_mise_en_service, lieu_utilisation, utilisation_partagee, tension_nominale_kv, intensite_maximale_ma, created_at, updated_at FROM appareil WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let appareil = stmt
        .query_row([id], |row| {
            Ok(Appareil {
                id: row.get(0)?,
                etablissement_id: row.get(1)?,
                designation: row.get(2)?,
                marque: row.get(3)?,
                modele: row.get(4)?,
                numero_serie: row.get(5)?,
                type_: row.get(6)?,
                annee_mise_en_service: row.get(7)?,
                lieu_utilisation: row.get(8)?,
                utilisation_partagee: row.get(9)?,
                tension_nominale_kv: row.get(10)?,
                intensite_maximale_ma: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(appareil)
}

#[tauri::command]
pub async fn appareil_create(
    etablissement_id: i64,
    designation: String,
    marque: Option<String>,
    modele: Option<String>,
    numero_serie: Option<String>,
    type_: Option<String>,
    annee_mise_en_service: Option<i64>,
    lieu_utilisation: Option<String>,
    utilisation_partagee: i64,
    tension_nominale_kv: Option<f64>,
    intensite_maximale_ma: Option<f64>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<i64, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute(
        "INSERT INTO appareil (etablissement_id, designation, marque, modele, numero_serie, type, annee_mise_en_service, lieu_utilisation, utilisation_partagee, tension_nominale_kv, intensite_maximale_ma)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            etablissement_id,
            designation,
            marque,
            modele,
            numero_serie,
            type_,
            annee_mise_en_service,
            lieu_utilisation,
            utilisation_partagee,
            tension_nominale_kv,
            intensite_maximale_ma,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub async fn appareil_update(
    id: i64,
    etablissement_id: i64,
    designation: String,
    marque: Option<String>,
    modele: Option<String>,
    numero_serie: Option<String>,
    type_: Option<String>,
    annee_mise_en_service: Option<i64>,
    lieu_utilisation: Option<String>,
    utilisation_partagee: i64,
    tension_nominale_kv: Option<f64>,
    intensite_maximale_ma: Option<f64>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute(
        "UPDATE appareil SET etablissement_id = ?1, designation = ?2, marque = ?3, modele = ?4, numero_serie = ?5, type = ?6, annee_mise_en_service = ?7, lieu_utilisation = ?8, utilisation_partagee = ?9, tension_nominale_kv = ?10, intensite_maximale_ma = ?11 WHERE id = ?12",
        rusqlite::params![
            etablissement_id,
            designation,
            marque,
            modele,
            numero_serie,
            type_,
            annee_mise_en_service,
            lieu_utilisation,
            utilisation_partagee,
            tension_nominale_kv,
            intensite_maximale_ma,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn appareil_delete(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<(), String> {
    eprintln!("[AUDIT] appareil_delete id={}", id);
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute("DELETE FROM appareil WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn init_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory DB");
        conn.execute_batch(include_str!("../schema.sql"))
            .expect("Failed to execute schema");
        conn
    }

    #[test]
    fn test_ensure_authenticated_when_false_returns_err() {
        let session = auth_totp::SessionState::new();
        assert!(auth_totp::ensure_authenticated(&session).is_err());
    }

    #[test]
    fn test_ensure_authenticated_when_true_returns_ok() {
        let session = auth_totp::SessionState::new();
        *session.authenticated.lock() = true;
        assert!(auth_totp::ensure_authenticated(&session).is_ok());
    }

    #[test]
    fn test_insert_and_list_appareil() {
        let conn = init_test_db();

        conn.execute(
            "INSERT INTO etablissement (denomination) VALUES (?1)",
            rusqlite::params!["Test Etab"],
        )
        .expect("Failed to insert etablissement");

        conn.execute(
            "INSERT INTO appareil (etablissement_id, designation, marque, modele, numero_serie, type, annee_mise_en_service, lieu_utilisation, utilisation_partagee, tension_nominale_kv, intensite_maximale_ma)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                1i64,
                "Appareil Test",
                Some("Marque X"),
                Some("Model Y"),
                Some("SN123456"),
                Some("Fixe"),
                Some(2020i64),
                Some("Salle 1"),
                0i64,
                Some(150.0),
                Some(500.0),
            ],
        )
        .expect("Failed to insert appareil");

        let mut stmt = conn
            .prepare("SELECT id, etablissement_id, designation, type FROM appareil WHERE id = ?1")
            .expect("Failed to prepare");

        let (id, etab_id, designation, type_): (i64, i64, String, Option<String>) = stmt
            .query_row([1i64], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
            .expect("Failed to query");

        assert_eq!(id, 1);
        assert_eq!(etab_id, 1);
        assert_eq!(designation, "Appareil Test");
        assert_eq!(type_, Some("Fixe".to_string()));
    }
}
