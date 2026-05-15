use crate::db::DbState;
use crate::models::VerificationTechnique;

#[tauri::command]
pub async fn verification_list(state: tauri::State<'_, DbState>) -> Result<Vec<VerificationTechnique>, String> {
    let conn = state.conn.lock();
    let mut stmt = conn
        .prepare("SELECT id, appareil_id, type, date_realisation, realise_par, organisme, observations, created_at FROM verification_technique ORDER BY id")
        .map_err(|e| e.to_string())?;

    let verifications = stmt
        .query_map([], |row| {
            Ok(VerificationTechnique {
                id: row.get(0)?,
                appareil_id: row.get(1)?,
                type_: row.get(2)?,
                date_realisation: row.get(3)?,
                realise_par: row.get(4)?,
                organisme: row.get(5)?,
                observations: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(verifications)
}

#[tauri::command]
pub async fn verification_get(id: i64, state: tauri::State<'_, DbState>) -> Result<VerificationTechnique, String> {
    let conn = state.conn.lock();
    let mut stmt = conn
        .prepare("SELECT id, appareil_id, type, date_realisation, realise_par, organisme, observations, created_at FROM verification_technique WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let verification = stmt
        .query_row([id], |row| {
            Ok(VerificationTechnique {
                id: row.get(0)?,
                appareil_id: row.get(1)?,
                type_: row.get(2)?,
                date_realisation: row.get(3)?,
                realise_par: row.get(4)?,
                organisme: row.get(5)?,
                observations: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(verification)
}

#[tauri::command]
pub async fn verification_create(
    appareil_id: i64,
    type_: String,
    date_realisation: String,
    realise_par: Option<String>,
    organisme: Option<String>,
    observations: Option<String>,
    state: tauri::State<'_, DbState>,
) -> Result<i64, String> {
    let conn = state.conn.lock();
    conn.execute(
        "INSERT INTO verification_technique (appareil_id, type, date_realisation, realise_par, organisme, observations)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![appareil_id, type_, date_realisation, realise_par, organisme, observations],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub async fn verification_update(
    id: i64,
    appareil_id: i64,
    type_: String,
    date_realisation: String,
    realise_par: Option<String>,
    organisme: Option<String>,
    observations: Option<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock();
    conn.execute(
        "UPDATE verification_technique SET appareil_id = ?1, type = ?2, date_realisation = ?3, realise_par = ?4, organisme = ?5, observations = ?6 WHERE id = ?7",
        rusqlite::params![appareil_id, type_, date_realisation, realise_par, organisme, observations, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn verification_delete(id: i64, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock();
    conn.execute("DELETE FROM verification_technique WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
