use crate::db::DbState;
use crate::auth_totp;

#[tauri::command]
pub async fn travailleur_appareil_list(
    travailleur_id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<i64>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT appareil_id FROM travailleur_appareil WHERE travailleur_id = ?1 ORDER BY appareil_id")
        .map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([travailleur_id], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ids)
}

#[tauri::command]
pub async fn travailleur_appareil_add(
    travailleur_id: i64,
    appareil_id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute(
        "INSERT OR IGNORE INTO travailleur_appareil (travailleur_id, appareil_id) VALUES (?1, ?2)",
        rusqlite::params![travailleur_id, appareil_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn travailleur_appareil_remove(
    travailleur_id: i64,
    appareil_id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute(
        "DELETE FROM travailleur_appareil WHERE travailleur_id = ?1 AND appareil_id = ?2",
        rusqlite::params![travailleur_id, appareil_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

