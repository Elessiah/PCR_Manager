use crate::db::DbState;
use crate::models::{CompetenceRef, CompetenceTravailleur};

#[tauri::command]
pub async fn competence_list(state: tauri::State<'_, DbState>) -> Result<Vec<CompetenceRef>, String> {
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
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
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
    state: tauri::State<'_, DbState>,
) -> Result<Vec<CompetenceTravailleur>, String> {
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
