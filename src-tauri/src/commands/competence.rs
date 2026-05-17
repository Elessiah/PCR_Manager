use crate::db::DbState;
use crate::models::{CompetenceRef, CompetenceTravailleur};
use crate::auth;

#[tauri::command]
pub async fn competence_ref_create(
    libelle: String,
    ordre: i64,
    session: tauri::State<'_, auth::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<CompetenceRef, String> {
    ensure_authenticated(&session)?;
    let conn = state.conn.lock();
    conn.execute(
        "INSERT INTO competence_ref (libelle, ordre) VALUES (?1, ?2)",
        rusqlite::params![libelle, ordre],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(CompetenceRef { id, libelle, ordre })
}

#[tauri::command]
pub async fn competence_ref_update(
    id: i64,
    libelle: String,
    ordre: i64,
    session: tauri::State<'_, auth::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    ensure_authenticated(&session)?;
    let conn = state.conn.lock();
    conn.execute(
        "UPDATE competence_ref SET libelle = ?1, ordre = ?2 WHERE id = ?3",
        rusqlite::params![libelle, ordre, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn competence_ref_delete(
    id: i64,
    session: tauri::State<'_, auth::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    ensure_authenticated(&session)?;
    let conn = state.conn.lock();
    conn.execute("DELETE FROM competence_ref WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn competence_list(session: tauri::State<'_, auth::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<CompetenceRef>, String> {
    ensure_authenticated(&session)?;
    let conn = state.conn.lock();
    let mut stmt = conn
        .prepare("SELECT id, libelle, ordre FROM competence_ref ORDER BY ordre")
        .map_err(|e| e.to_string())?;

    let competences = stmt
        .query_map([], |row| {
            Ok(CompetenceRef {
                id: row.get(0)?,
                libelle: row.get(1)?,
                ordre: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(competences)
}

#[tauri::command]
pub async fn competence_set(
    travailleur_id: i64,
    appareil_id: i64,
    competence_ref_id: i64,
    date_validation: Option<String>,
    validated: i64,
    session: tauri::State<'_, auth::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    eprintln!("[AUDIT] competence_set travailleur_id={} appareil_id={}", travailleur_id, appareil_id);
    ensure_authenticated(&session)?;
    let conn = state.conn.lock();

    conn.execute(
        "INSERT INTO competence_travailleur (travailleur_id, appareil_id, competence_ref_id, date_validation, validated)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(travailleur_id, appareil_id, competence_ref_id) DO UPDATE SET
         date_validation = ?4, validated = ?5",
        rusqlite::params![travailleur_id, appareil_id, competence_ref_id, date_validation, validated],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn competence_get_for_travailleur(
    travailleur_id: i64,
    session: tauri::State<'_, auth::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<CompetenceTravailleur>, String> {
    ensure_authenticated(&session)?;
    let conn = state.conn.lock();
    let mut stmt = conn
        .prepare("SELECT id, travailleur_id, appareil_id, competence_ref_id, date_validation, validated FROM competence_travailleur WHERE travailleur_id = ?1 ORDER BY id")
        .map_err(|e| e.to_string())?;

    let competences = stmt
        .query_map([travailleur_id], |row| {
            Ok(CompetenceTravailleur {
                id: row.get(0)?,
                travailleur_id: row.get(1)?,
                appareil_id: row.get(2)?,
                competence_ref_id: row.get(3)?,
                date_validation: row.get(4)?,
                validated: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(competences)
}

fn ensure_authenticated(session: &auth::SessionState) -> Result<(), String> {
    if !*session.authenticated.lock() {
        return Err("Non authentifié".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_authenticated_when_false_returns_err() {
        let session = auth::SessionState::new();
        assert!(ensure_authenticated(&session).is_err());
    }

    #[test]
    fn test_ensure_authenticated_when_true_returns_ok() {
        let session = auth::SessionState::new();
        *session.authenticated.lock() = true;
        assert!(ensure_authenticated(&session).is_ok());
    }
}
