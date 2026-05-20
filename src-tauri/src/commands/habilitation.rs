use crate::db::DbState;
use crate::models::{HabilitationStatus, HabilitationDetails, Habilitation};
use crate::auth_iphone;
use chrono::NaiveDate;

pub fn desactiver_competences_perimees(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE competence_travailleur SET validated = 0 WHERE validated = 1 AND date_peremption IS NOT NULL AND date_peremption < date('now')",
        [],
    )?;
    conn.execute(
        "UPDATE competence_travailleur_general SET validated = 0 WHERE validated = 1 AND date_peremption IS NOT NULL AND date_peremption < date('now')",
        [],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn habilitation_compute(travailleur_id: i64, session: tauri::State<'_, auth_iphone::SessionState>, state: tauri::State<'_, DbState>) -> Result<HabilitationStatus, String> {
    ensure_authenticated(&session)?;
    let conn = state.get()?;

    if let Err(e) = desactiver_competences_perimees(&conn) {
        eprintln!("Warning: Failed to deactivate expired competences: {}", e);
    }

    let habilitation_result: (Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<i64>) = match conn
        .query_row(
            "SELECT dosimetrie_passive_date, dosimetrie_operationnelle_date, formation_rp_travailleurs_date, formation_rp_patients_date, visite_medicale_date, visite_medicale_date_peremption, visite_medicale_duree_mois FROM habilitation WHERE travailleur_id = ?1",
            [travailleur_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
        )
    {
        Ok(hab) => hab,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Ok(HabilitationStatus {
                statut: "non_validee".to_string(),
                details: HabilitationDetails {
                    formation_rp_ok: false,
                    dosimetries_ok: false,
                    competences_ok: false,
                    visite_med_ok: false,
                },
            });
        }
        Err(e) => return Err(e.to_string()),
    };

    let habilitation = habilitation_result;

    let (dosim_passive, _dosim_op, form_rp_workers, _form_rp_patients, visite_med_date, visite_med_date_peremption, visite_med_duree_mois) = habilitation;

    // dosimetries_ok: dosim_passive non NULL
    let dosimetries_ok = dosim_passive.is_some();

    // formation_rp_ok: formation_rp_travailleurs_date dans les 3 ans
    let formation_rp_ok = if let Some(date_str) = &form_rp_workers {
        check_date_within_years(date_str, 3)
    } else {
        false
    };

    // visite_med_ok
    let visite_med_ok = if let Some(date_peremption) = visite_med_date_peremption {
        check_date_not_expired(&date_peremption)
    } else if let Some(duree_mois) = visite_med_duree_mois {
        if let Some(date_str) = visite_med_date {
            check_date_with_months(&date_str, duree_mois)
        } else {
            false
        }
    } else if let Some(date_str) = visite_med_date {
        check_date_within_years(&date_str, 1)
    } else {
        false
    };

    // competences_ok
    let competences_ok = verify_competences_ok(&conn, travailleur_id).map_err(|e| e.to_string())?;

    let details = HabilitationDetails {
        formation_rp_ok,
        dosimetries_ok,
        competences_ok,
        visite_med_ok,
    };

    let statut = if formation_rp_ok && dosimetries_ok && competences_ok && visite_med_ok {
        "validee".to_string()
    } else if (formation_rp_ok as i32) + (dosimetries_ok as i32) + (competences_ok as i32) + (visite_med_ok as i32) > 0 {
        "partielle".to_string()
    } else {
        "non_validee".to_string()
    };

    Ok(HabilitationStatus { statut, details })
}

#[tauri::command]
pub async fn habilitation_update(
    travailleur_id: i64,
    dosimetrie_passive_date: Option<String>,
    dosimetrie_operationnelle_date: Option<String>,
    formation_rp_travailleurs_date: Option<String>,
    formation_rp_patients_date: Option<String>,
    visite_medicale_date: Option<String>,
    visite_medicale_duree_mois: Option<i64>,
    visite_medicale_date_peremption: Option<String>,
    session: tauri::State<'_, auth_iphone::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    ensure_authenticated(&session)?;
    let conn = state.get()?;

    conn.execute(
        "INSERT INTO habilitation (travailleur_id, dosimetrie_passive_date, dosimetrie_operationnelle_date, formation_rp_travailleurs_date, formation_rp_patients_date, visite_medicale_date, visite_medicale_duree_mois, visite_medicale_date_peremption) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(travailleur_id) DO UPDATE SET dosimetrie_passive_date = COALESCE(excluded.dosimetrie_passive_date, habilitation.dosimetrie_passive_date), dosimetrie_operationnelle_date = COALESCE(excluded.dosimetrie_operationnelle_date, habilitation.dosimetrie_operationnelle_date), formation_rp_travailleurs_date = COALESCE(excluded.formation_rp_travailleurs_date, habilitation.formation_rp_travailleurs_date), formation_rp_patients_date = COALESCE(excluded.formation_rp_patients_date, habilitation.formation_rp_patients_date), visite_medicale_date = COALESCE(excluded.visite_medicale_date, habilitation.visite_medicale_date), visite_medicale_duree_mois = COALESCE(excluded.visite_medicale_duree_mois, habilitation.visite_medicale_duree_mois), visite_medicale_date_peremption = COALESCE(excluded.visite_medicale_date_peremption, habilitation.visite_medicale_date_peremption)",
        rusqlite::params![
            travailleur_id,
            dosimetrie_passive_date,
            dosimetrie_operationnelle_date,
            formation_rp_travailleurs_date,
            formation_rp_patients_date,
            visite_medicale_date,
            visite_medicale_duree_mois,
            visite_medicale_date_peremption,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn habilitation_get_for_travailleur(
    travailleur_id: i64,
    session: tauri::State<'_, auth_iphone::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Habilitation, String> {
    ensure_authenticated(&session)?;
    let conn = state.get()?;

    let result = conn.query_row(
        "SELECT id, travailleur_id, dosimetrie_passive_date, dosimetrie_operationnelle_date, formation_rp_travailleurs_date, formation_rp_patients_date, visite_medicale_date, visite_medicale_date_peremption, visite_medicale_duree_mois, updated_at FROM habilitation WHERE travailleur_id = ?1",
        [travailleur_id],
        |row| {
            Ok(Habilitation {
                id: row.get(0)?,
                travailleur_id: row.get(1)?,
                dosimetrie_passive_date: row.get(2)?,
                dosimetrie_operationnelle_date: row.get(3)?,
                formation_rp_travailleurs_date: row.get(4)?,
                formation_rp_patients_date: row.get(5)?,
                visite_medicale_date: row.get(6)?,
                visite_medicale_date_peremption: row.get(7)?,
                visite_medicale_duree_mois: row.get(8)?,
                updated_at: row.get(9)?,
            })
        }
    );

    match result {
        Ok(hab) => Ok(hab),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Ok(Habilitation {
                id: 0,
                travailleur_id,
                dosimetrie_passive_date: None,
                dosimetrie_operationnelle_date: None,
                formation_rp_travailleurs_date: None,
                formation_rp_patients_date: None,
                visite_medicale_date: None,
                visite_medicale_date_peremption: None,
                visite_medicale_duree_mois: None,
                updated_at: String::new(),
            })
        }
        Err(e) => Err(e.to_string()),
    }
}

fn verify_competences_ok(conn: &rusqlite::Connection, travailleur_id: i64) -> rusqlite::Result<bool> {
    let has_appareils: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM travailleur_appareil WHERE travailleur_id = ?1",
            [travailleur_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_appareils {
        return Ok(false);
    }

    let mut stmt = conn.prepare(
        "SELECT DISTINCT appareil_id FROM travailleur_appareil WHERE travailleur_id = ?1"
    )?;

    let appareil_ids: Vec<i64> = stmt
        .query_map([travailleur_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for appareil_id in appareil_ids {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT competence_ref_id FROM appareil_competence_ref WHERE appareil_id = ?1"
        )?;

        let competence_ids: Vec<i64> = stmt
            .query_map([appareil_id], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;

        for competence_id in competence_ids {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM competence_travailleur WHERE travailleur_id = ?1 AND appareil_id = ?2 AND competence_ref_id = ?3 AND validated = 1",
                    rusqlite::params![travailleur_id, appareil_id, competence_id],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if !exists {
                return Ok(false);
            }
        }
    }

    let mut stmt = conn.prepare(
        "SELECT id FROM competence_ref WHERE propre_appareil = 0"
    )?;

    let general_competence_ids: Vec<i64> = stmt
        .query_map([], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for competence_id in general_competence_ids {
        let is_validated: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM competence_travailleur_general WHERE travailleur_id = ?1 AND competence_ref_id = ?2 AND validated = 1",
                rusqlite::params![travailleur_id, competence_id],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !is_validated {
            return Ok(false);
        }
    }

    Ok(true)
}

fn ensure_authenticated(session: &auth_iphone::SessionState) -> Result<(), String> {
    if !*session.authenticated.lock() {
        return Err("Non authentifiÃ©".to_string());
    }
    Ok(())
}

fn check_date_not_expired(date_str: &str) -> bool {
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let now = chrono::Local::now().naive_local().date();
        now <= date
    } else {
        false
    }
}

fn check_date_within_years(date_str: &str, years: i32) -> bool {
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let now = chrono::Local::now().naive_local().date();
        let threshold = date + chrono::Duration::days(365 * years as i64);
        now <= threshold
    } else {
        false
    }
}

fn check_date_with_months(date_str: &str, months: i64) -> bool {
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let now = chrono::Local::now().naive_local().date();
        let days = 30 * months;
        let threshold = date + chrono::Duration::days(days);
        now <= threshold
    } else {
        false
    }
}

#[allow(dead_code)]
fn compute_competences_ok(conn: &rusqlite::Connection, travailleur_id: i64) -> rusqlite::Result<bool> {
    verify_competences_ok(conn, travailleur_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../../migrations/V1__initial.sql")).unwrap();
        conn.execute_batch(include_str!("../../migrations/V3__competence_description.sql")).unwrap();
        conn.execute_batch(include_str!("../../migrations/V4__appareil_competences.sql")).unwrap();
        conn.execute_batch(include_str!("../../migrations/V6__competence_validity_assignments.sql")).unwrap();
        conn
    }

    #[test]
    fn test_ensure_authenticated_when_false_returns_err() {
        let session = auth_iphone::SessionState::new();
        assert!(ensure_authenticated(&session).is_err());
    }

    #[test]
    fn test_ensure_authenticated_when_true_returns_ok() {
        let session = auth_iphone::SessionState::new();
        *session.authenticated.lock() = true;
        assert!(ensure_authenticated(&session).is_ok());
    }

    #[test]
    fn test_desactiver_competences_perimees_passe_validated_a_zero() {
        let conn = setup_db();

        let etab_id = {
            conn.execute(
                "INSERT INTO etablissement (denomination) VALUES (?1)",
                rusqlite::params!["Test Etab"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let trav_id = {
            conn.execute(
                "INSERT INTO travailleur (etablissement_id, nom, prenom) VALUES (?1, ?2, ?3)",
                rusqlite::params![etab_id, "Dupont", "Jean"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let app_id = {
            conn.execute(
                "INSERT INTO appareil (etablissement_id, designation) VALUES (?1, ?2)",
                rusqlite::params![etab_id, "Appareil Test"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let comp_id = 1i64;

        conn.execute(
            "INSERT INTO competence_travailleur (travailleur_id, appareil_id, competence_ref_id, validated, date_peremption) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![trav_id, app_id, comp_id, 1, "2020-01-01"],
        ).unwrap();

        desactiver_competences_perimees(&conn).unwrap();

        let validated: i64 = conn.query_row(
            "SELECT validated FROM competence_travailleur WHERE travailleur_id = ?1 AND appareil_id = ?2",
            rusqlite::params![trav_id, app_id],
            |row| row.get(0),
        ).unwrap();

        assert_eq!(validated, 0);
    }

    #[test]
    fn test_competences_ok_false_si_aucun_appareil_assigne() {
        let conn = setup_db();

        let etab_id = {
            conn.execute(
                "INSERT INTO etablissement (denomination) VALUES (?1)",
                rusqlite::params!["Test Etab"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let trav_id = {
            conn.execute(
                "INSERT INTO travailleur (etablissement_id, nom, prenom) VALUES (?1, ?2, ?3)",
                rusqlite::params![etab_id, "Dupont", "Jean"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let result = compute_competences_ok(&conn, trav_id).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_competences_ok_true_avec_un_appareil_complet() {
        let conn = setup_db();

        let etab_id = {
            conn.execute(
                "INSERT INTO etablissement (denomination) VALUES (?1)",
                rusqlite::params!["Test Etab"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let trav_id = {
            conn.execute(
                "INSERT INTO travailleur (etablissement_id, nom, prenom) VALUES (?1, ?2, ?3)",
                rusqlite::params![etab_id, "Dupont", "Jean"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        let app_id = {
            conn.execute(
                "INSERT INTO appareil (etablissement_id, designation) VALUES (?1, ?2)",
                rusqlite::params![etab_id, "Appareil Test"],
            ).unwrap();
            conn.last_insert_rowid()
        };

        conn.execute(
            "INSERT INTO travailleur_appareil (travailleur_id, appareil_id) VALUES (?1, ?2)",
            rusqlite::params![trav_id, app_id],
        ).unwrap();

        conn.execute(
            "UPDATE competence_ref SET propre_appareil = 1 WHERE id = 1",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO appareil_competence_ref (appareil_id, competence_ref_id) VALUES (?1, ?2)",
            rusqlite::params![app_id, 1],
        ).unwrap();

        conn.execute(
            "INSERT INTO competence_travailleur (travailleur_id, appareil_id, competence_ref_id, validated) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![trav_id, app_id, 1, 1],
        ).unwrap();

        conn.execute(
            "UPDATE competence_ref SET propre_appareil = 0 WHERE id = 2",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO competence_travailleur_general (travailleur_id, competence_ref_id, validated) VALUES (?1, ?2, ?3)",
            rusqlite::params![trav_id, 2, 1],
        ).unwrap();

        let result = compute_competences_ok(&conn, trav_id).unwrap();
        assert!(result);
    }
}
