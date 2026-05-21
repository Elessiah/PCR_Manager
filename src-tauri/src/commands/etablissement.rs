use crate::db::DbState;
use crate::models::Etablissement;
use crate::auth_totp;

#[tauri::command]
pub async fn etablissement_list(session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<Etablissement>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, denomination, statut_juridique, siret, adresse, code_postal, ville, telephone, email, site_internet, kbis_chemin, created_at, updated_at FROM etablissement ORDER BY id")
        .map_err(|e| e.to_string())?;

    let etabs = stmt
        .query_map([], |row| {
            Ok(Etablissement {
                id: row.get(0)?,
                denomination: row.get(1)?,
                statut_juridique: row.get(2)?,
                siret: row.get(3)?,
                adresse: row.get(4)?,
                code_postal: row.get(5)?,
                ville: row.get(6)?,
                telephone: row.get(7)?,
                email: row.get(8)?,
                site_internet: row.get(9)?,
                kbis_chemin: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(etabs)
}

#[tauri::command]
pub async fn etablissement_get(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Etablissement, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, denomination, statut_juridique, siret, adresse, code_postal, ville, telephone, email, site_internet, kbis_chemin, created_at, updated_at FROM etablissement WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let etab = stmt
        .query_row([id], |row| {
            Ok(Etablissement {
                id: row.get(0)?,
                denomination: row.get(1)?,
                statut_juridique: row.get(2)?,
                siret: row.get(3)?,
                adresse: row.get(4)?,
                code_postal: row.get(5)?,
                ville: row.get(6)?,
                telephone: row.get(7)?,
                email: row.get(8)?,
                site_internet: row.get(9)?,
                kbis_chemin: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(etab)
}

#[tauri::command]
pub async fn etablissement_create(
    denomination: String,
    statut_juridique: Option<String>,
    siret: Option<String>,
    adresse: Option<String>,
    code_postal: Option<String>,
    ville: Option<String>,
    telephone: Option<String>,
    email: Option<String>,
    site_internet: Option<String>,
    kbis_chemin: Option<String>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<i64, String> {
    auth_totp::ensure_authenticated(&session)?;
    if let Some(ref s) = siret {
        crate::validators::validate_siret(s)?;
    }
    let conn = state.get()?;
    conn.execute(
        "INSERT INTO etablissement (denomination, statut_juridique, siret, adresse, code_postal, ville, telephone, email, site_internet, kbis_chemin)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            denomination,
            statut_juridique,
            siret,
            adresse,
            code_postal,
            ville,
            telephone,
            email,
            site_internet,
            kbis_chemin,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub async fn etablissement_update(
    id: i64,
    denomination: String,
    statut_juridique: Option<String>,
    siret: Option<String>,
    adresse: Option<String>,
    code_postal: Option<String>,
    ville: Option<String>,
    telephone: Option<String>,
    email: Option<String>,
    site_internet: Option<String>,
    kbis_chemin: Option<String>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    if let Some(ref s) = siret {
        crate::validators::validate_siret(s)?;
    }
    let conn = state.get()?;
    conn.execute(
        "UPDATE etablissement SET denomination = ?1, statut_juridique = ?2, siret = ?3, adresse = ?4, code_postal = ?5, ville = ?6, telephone = ?7, email = ?8, site_internet = ?9, kbis_chemin = ?10 WHERE id = ?11",
        rusqlite::params![
            denomination,
            statut_juridique,
            siret,
            adresse,
            code_postal,
            ville,
            telephone,
            email,
            site_internet,
            kbis_chemin,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn etablissement_delete(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<(), String> {
    eprintln!("[AUDIT] etablissement_delete id={}", id);
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute("DELETE FROM etablissement WHERE id = ?1", [id])
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
    fn test_insert_and_list_etablissement() {
        let conn = init_test_db();

        conn.execute(
            "INSERT INTO etablissement (denomination, statut_juridique, siret, adresse, code_postal, ville, telephone, email, site_internet, kbis_chemin)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                "Test Corp",
                Some("SARL"),
                Some("12345678901234"),
                Some("123 Rue Test"),
                Some("75001"),
                Some("Paris"),
                Some("0123456789"),
                Some("test@corp.fr"),
                Some("https://test.fr"),
                Some("kbis.pdf"),
            ],
        )
        .expect("Failed to insert");

        let mut stmt = conn
            .prepare("SELECT id, denomination, statut_juridique, siret, adresse, code_postal, ville, telephone, email, site_internet, kbis_chemin FROM etablissement ORDER BY id")
            .expect("Failed to prepare");

        let count: i64 = stmt
            .query_row([], |row| {
                let id: i64 = row.get(0)?;
                let denom: String = row.get(1)?;
                assert_eq!(denom, "Test Corp");
                assert_eq!(row.get::<_, Option<String>>(2)?, Some("SARL".to_string()));
                Ok(id)
            })
            .expect("Failed to query");

        assert_eq!(count, 1);
    }

    #[test]
    fn test_update_etablissement() {
        let conn = init_test_db();

        conn.execute(
            "INSERT INTO etablissement (denomination, statut_juridique, siret, adresse, code_postal, ville, telephone, email, site_internet, kbis_chemin)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                "Old Name",
                Some("SARL"),
                Some("12345678901234"),
                Some("123 Rue Test"),
                Some("75001"),
                Some("Paris"),
                Some("0123456789"),
                Some("test@corp.fr"),
                Some("https://test.fr"),
                Some("kbis.pdf"),
            ],
        )
        .expect("Failed to insert");

        conn.execute(
            "UPDATE etablissement SET denomination = ?1, statut_juridique = ?2 WHERE id = ?3",
            rusqlite::params!["New Name", Some("SAS"), 1i64],
        )
        .expect("Failed to update");

        let mut stmt = conn
            .prepare("SELECT denomination, statut_juridique FROM etablissement WHERE id = ?1")
            .expect("Failed to prepare");

        let (denom, status): (String, Option<String>) = stmt
            .query_row([1i64], |row| Ok((row.get(0)?, row.get(1)?)))
            .expect("Failed to query");

        assert_eq!(denom, "New Name");
        assert_eq!(status, Some("SAS".to_string()));
    }
}
