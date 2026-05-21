use crate::db::DbState;
use crate::models::{CompetenceRef, CompetenceTravailleur, CompetenceTravailleurGeneral};
use crate::auth_totp;
use chrono::{NaiveDate, Months};

#[tauri::command]
pub async fn competence_ref_create(
    libelle: String,
    ordre: i64,
    description: Option<String>,
    propre_appareil: i64,
    duree_validite_mois: Option<i64>,
    duree_alerte_mois: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<CompetenceRef, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute(
        "INSERT INTO competence_ref (libelle, ordre, description, propre_appareil, duree_validite_mois, duree_alerte_mois) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![libelle, ordre, description, propre_appareil, duree_validite_mois, duree_alerte_mois],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(CompetenceRef { id, libelle, ordre, description, propre_appareil, duree_validite_mois, duree_alerte_mois })
}

#[tauri::command]
pub async fn competence_ref_update(
    id: i64,
    libelle: String,
    ordre: i64,
    description: Option<String>,
    propre_appareil: i64,
    duree_validite_mois: Option<i64>,
    duree_alerte_mois: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute(
        "UPDATE competence_ref SET libelle = ?1, ordre = ?2, description = ?3, propre_appareil = ?4, duree_validite_mois = ?5, duree_alerte_mois = ?6 WHERE id = ?7",
        rusqlite::params![libelle, ordre, description, propre_appareil, duree_validite_mois, duree_alerte_mois, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn competence_ref_delete(
    id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute("DELETE FROM competence_ref WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn competence_list(session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<CompetenceRef>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, libelle, ordre, description, propre_appareil, duree_validite_mois, duree_alerte_mois FROM competence_ref ORDER BY ordre")
        .map_err(|e| e.to_string())?;

    let competences = stmt
        .query_map([], |row| {
            Ok(CompetenceRef {
                id: row.get(0)?,
                libelle: row.get(1)?,
                ordre: row.get(2)?,
                description: row.get(3)?,
                propre_appareil: row.get(4)?,
                duree_validite_mois: row.get(5)?,
                duree_alerte_mois: row.get(6)?,
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
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    eprintln!("[AUDIT] competence_set travailleur_id={} appareil_id={}", travailleur_id, appareil_id);
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;

    let date_peremption = if validated == 1 {
        match &date_validation {
            Some(dv) => calc_date_peremption(&*conn, competence_ref_id, dv)?,
            None => {
                let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                calc_date_peremption(&*conn, competence_ref_id, &today)?
            }
        }
    } else {
        None
    };

    conn.execute(
        "INSERT INTO competence_travailleur (travailleur_id, appareil_id, competence_ref_id, date_validation, validated, date_peremption)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(travailleur_id, appareil_id, competence_ref_id) DO UPDATE SET
         date_validation = ?4, validated = ?5, date_peremption = ?6",
        rusqlite::params![travailleur_id, appareil_id, competence_ref_id, date_validation, validated, date_peremption],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn competence_get_for_travailleur(
    travailleur_id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<CompetenceTravailleur>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, travailleur_id, appareil_id, competence_ref_id, date_validation, validated, date_peremption FROM competence_travailleur WHERE travailleur_id = ?1 ORDER BY id")
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
                date_peremption: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(competences)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CompÃ©tences gÃ©nÃ©rales (table competence_travailleur_general, V6)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[tauri::command]
pub async fn competence_general_set(
    travailleur_id: i64,
    competence_ref_id: i64,
    date_validation: Option<String>,
    validated: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;

    let date_peremption = if validated == 1 {
        match &date_validation {
            Some(dv) => calc_date_peremption(&*conn, competence_ref_id, dv)?,
            None => {
                let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                calc_date_peremption(&*conn, competence_ref_id, &today)?
            }
        }
    } else {
        None
    };

    conn.execute(
        "INSERT INTO competence_travailleur_general (travailleur_id, competence_ref_id, date_validation, validated, date_peremption)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(travailleur_id, competence_ref_id) DO UPDATE SET
         date_validation = ?3, validated = ?4, date_peremption = ?5",
        rusqlite::params![travailleur_id, competence_ref_id, date_validation, validated, date_peremption],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn competence_general_get_for_travailleur(
    travailleur_id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<CompetenceTravailleurGeneral>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, travailleur_id, competence_ref_id, date_validation, date_peremption, validated FROM competence_travailleur_general WHERE travailleur_id = ?1 ORDER BY id")
        .map_err(|e| e.to_string())?;

    let competences = stmt
        .query_map([travailleur_id], |row| {
            Ok(CompetenceTravailleurGeneral {
                id: row.get(0)?,
                travailleur_id: row.get(1)?,
                competence_ref_id: row.get(2)?,
                date_validation: row.get(3)?,
                date_peremption: row.get(4)?,
                validated: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(competences)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CompÃ©tences requises par appareil (table appareil_competence_ref, V4)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[tauri::command]
pub async fn appareil_competence_add(
    appareil_id: i64,
    competence_ref_id: i64,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.get()?;
    conn.execute(
        "INSERT OR IGNORE INTO appareil_competence_ref (appareil_id, competence_ref_id) VALUES (?1, ?2)",
        rusqlite::params![appareil_id, competence_ref_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn appareil_competence_remove(
    appareil_id: i64,
    competence_ref_id: i64,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.get()?;
    conn.execute(
        "DELETE FROM appareil_competence_ref WHERE appareil_id = ?1 AND competence_ref_id = ?2",
        rusqlite::params![appareil_id, competence_ref_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn appareil_competence_list(
    appareil_id: i64,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<i64>, String> {
    let conn = state.get()?;
    let mut stmt = conn
        .prepare(
            "SELECT competence_ref_id FROM appareil_competence_ref \
             WHERE appareil_id = ?1 ORDER BY competence_ref_id",
        )
        .map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([appareil_id], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ids)
}

fn calc_date_peremption(conn: &rusqlite::Connection, competence_ref_id: i64, date_validation: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT duree_validite_mois FROM competence_ref WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let duree_validite_mois: Option<i64> = stmt
        .query_row([competence_ref_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    match duree_validite_mois {
        None => Ok(None),
        Some(months) => {
            let base_date = NaiveDate::parse_from_str(date_validation, "%Y-%m-%d")
                .map_err(|e| e.to_string())?;
            let peremption_date = base_date.checked_add_months(Months::new(months as u32))
                .ok_or_else(|| "Date calculation failed".to_string())?;
            Ok(Some(peremption_date.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../schema.sql")).unwrap();
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
    fn test_calc_date_peremption_avec_duree_12_mois() {
        let conn = setup_db();

        conn.execute(
            "UPDATE competence_ref SET duree_validite_mois = 12 WHERE id = 1",
            [],
        ).unwrap();

        let result = calc_date_peremption(&conn, 1, "2026-01-15").unwrap();

        assert_eq!(result, Some("2027-01-15".to_string()));
    }

    #[test]
    fn test_calc_date_peremption_avec_duree_null_retourne_none() {
        let conn = setup_db();

        let result = calc_date_peremption(&conn, 1, "2026-01-15").unwrap();

        assert_eq!(result, None);
    }
}
