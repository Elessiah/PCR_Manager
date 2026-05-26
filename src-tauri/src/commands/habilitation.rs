use crate::db::DbState;
use crate::models::{HabilitationStatus, HabilitationDetails, Habilitation};
use crate::auth_totp;
use chrono::{NaiveDate, Months};

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
pub async fn habilitation_compute(travailleur_id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<HabilitationStatus, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;

    let _ = desactiver_competences_perimees(&conn);

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
                    formation_rp_patients_ok: false,
                    dosimetries_ok: false,
                    competences_ok: false,
                    visite_med_ok: false,
                },
            });
        }
        Err(e) => return Err(e.to_string()),
    };

    let habilitation = habilitation_result;

    let (dosim_passive, dosim_op, form_rp_workers, form_rp_patients, visite_med_date, visite_med_date_peremption, visite_med_duree_mois) = habilitation;

    // dosimetries_ok: passive ET opérationnelle toutes deux dans les 2 ans
    let dosimetries_ok = match (&dosim_passive, &dosim_op) {
        (Some(p), Some(o)) => check_date_within_years(p, 2) && check_date_within_years(o, 2),
        _ => false,
    };

    // formation_rp_ok: formation_rp_travailleurs_date dans les 3 ans (CDC §5)
    let formation_rp_ok = if let Some(date_str) = &form_rp_workers {
        check_date_within_years(date_str, 3)
    } else {
        false
    };

    // formation_rp_patients_ok: formation_rp_patients_date dans les 7 ans (CDC §5)
    let formation_rp_patients_ok = if let Some(date_str) = &form_rp_patients {
        check_date_within_years(date_str, 7)
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
        formation_rp_patients_ok,
        dosimetries_ok,
        competences_ok,
        visite_med_ok,
    };

    let statut = if formation_rp_ok && formation_rp_patients_ok && dosimetries_ok && competences_ok && visite_med_ok {
        "validee".to_string()
    } else if (formation_rp_ok as i32) + (formation_rp_patients_ok as i32) + (dosimetries_ok as i32) + (competences_ok as i32) + (visite_med_ok as i32) > 0 {
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
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    if let Some(ref d) = dosimetrie_passive_date { crate::validators::validate_date(d)?; }
    if let Some(ref d) = dosimetrie_operationnelle_date { crate::validators::validate_date(d)?; }
    if let Some(ref d) = formation_rp_travailleurs_date { crate::validators::validate_date(d)?; }
    if let Some(ref d) = formation_rp_patients_date { crate::validators::validate_date(d)?; }
    if let Some(ref d) = visite_medicale_date { crate::validators::validate_date(d)?; }
    if let Some(ref d) = visite_medicale_date_peremption { crate::validators::validate_date(d)?; }
    let conn = state.get()?;

    conn.execute(
        "INSERT INTO habilitation (travailleur_id, dosimetrie_passive_date, dosimetrie_operationnelle_date, formation_rp_travailleurs_date, formation_rp_patients_date, visite_medicale_date, visite_medicale_duree_mois, visite_medicale_date_peremption) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(travailleur_id) DO UPDATE SET dosimetrie_passive_date = excluded.dosimetrie_passive_date, dosimetrie_operationnelle_date = excluded.dosimetrie_operationnelle_date, formation_rp_travailleurs_date = excluded.formation_rp_travailleurs_date, formation_rp_patients_date = excluded.formation_rp_patients_date, visite_medicale_date = excluded.visite_medicale_date, visite_medicale_duree_mois = excluded.visite_medicale_duree_mois, visite_medicale_date_peremption = excluded.visite_medicale_date_peremption",
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
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Habilitation, String> {
    auth_totp::ensure_authenticated(&session)?;
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
        let threshold = date
            .checked_add_months(Months::new(12 * years as u32))
            .unwrap_or(date);
        now <= threshold
    } else {
        false
    }
}

fn check_date_with_months(date_str: &str, months: i64) -> bool {
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let now = chrono::Local::now().naive_local().date();
        let threshold = date
            .checked_add_months(Months::new(months as u32))
            .unwrap_or(date);
        now <= threshold
    } else {
        false
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

}
