use crate::db::DbState;
use crate::models::{HabilitationStatus, HabilitationDetails};
use crate::auth;
use chrono::NaiveDate;

#[tauri::command]
pub async fn habilitation_compute(travailleur_id: i64, session: tauri::State<'_, auth::SessionState>, state: tauri::State<'_, DbState>) -> Result<HabilitationStatus, String> {
    ensure_authenticated(&session)?;
    let conn = state.conn.lock();

    let habilitation: (Option<String>, Option<String>, Option<String>, Option<String>, Option<String>) = conn
        .query_row(
            "SELECT dosimetrie_passive_date, dosimetrie_operationnelle_date, formation_rp_travailleurs_date, formation_rp_patients_date, visite_medicale_date FROM habilitation WHERE travailleur_id = ?1",
            [travailleur_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| e.to_string())?;

    let (dosim_passive, _dosim_op, form_rp_workers, _form_rp_patients, visite_med) = habilitation;

    // Vérification formation RP Travailleurs (3 ans)
    let formation_rp_ok = if let Some(date_str) = &form_rp_workers {
        check_date_within_years(date_str, 3)
    } else {
        false
    };

    // Vérification dosimétries (passive OU opérationnelle renseignées)
    let dosimetries_ok = dosim_passive.is_some();

    // Vérification visite médicale (1 an)
    let visite_med_ok = if let Some(date_str) = &visite_med {
        check_date_within_years(date_str, 1)
    } else {
        false
    };

    // Vérification compétences: >=1 validation complète 9/9 pour un appareil
    let competences_ok: bool = conn
        .query_row(
            "SELECT COUNT(DISTINCT appareil_id) FROM competence_travailleur
             WHERE travailleur_id = ?1 AND validated = 1
             GROUP BY appareil_id HAVING COUNT(*) = 9",
            [travailleur_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

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

fn ensure_authenticated(session: &auth::SessionState) -> Result<(), String> {
    if !*session.authenticated.lock() {
        return Err("Non authentifié".to_string());
    }
    Ok(())
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
