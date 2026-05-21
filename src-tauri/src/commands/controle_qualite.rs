use crate::db::DbState;
use crate::models::ControleQualite;
use crate::auth_totp;

#[tauri::command]
pub async fn controle_qualite_list(session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<ControleQualite>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, appareil_id, type, date_realisation, date_echeance, controle_externe_id, organisme, realise_par, statut, observations, created_at FROM controle_qualite ORDER BY id")
        .map_err(|e| e.to_string())?;

    let controles = stmt
        .query_map([], |row| {
            Ok(ControleQualite {
                id: row.get(0)?,
                appareil_id: row.get(1)?,
                type_: row.get(2)?,
                date_realisation: row.get(3)?,
                date_echeance: row.get(4)?,
                controle_externe_id: row.get(5)?,
                organisme: row.get(6)?,
                realise_par: row.get(7)?,
                statut: row.get(8)?,
                observations: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(controles)
}

#[tauri::command]
pub async fn controle_qualite_get(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<ControleQualite, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, appareil_id, type, date_realisation, date_echeance, controle_externe_id, organisme, realise_par, statut, observations, created_at FROM controle_qualite WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let controle = stmt
        .query_row([id], |row| {
            Ok(ControleQualite {
                id: row.get(0)?,
                appareil_id: row.get(1)?,
                type_: row.get(2)?,
                date_realisation: row.get(3)?,
                date_echeance: row.get(4)?,
                controle_externe_id: row.get(5)?,
                organisme: row.get(6)?,
                realise_par: row.get(7)?,
                statut: row.get(8)?,
                observations: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(controle)
}

#[tauri::command]
pub async fn controle_qualite_create(
    appareil_id: i64,
    type_: String,
    date_realisation: Option<String>,
    date_echeance: String,
    controle_externe_id: Option<i64>,
    organisme: Option<String>,
    realise_par: Option<String>,
    statut: String,
    observations: Option<String>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<i64, String> {
    auth_totp::ensure_authenticated(&session)?;
    crate::validators::validate_date(&date_echeance)?;
    if let Some(ref d) = date_realisation { crate::validators::validate_date(d)?; }
    let conn = state.get()?;
    conn.execute(
        "INSERT INTO controle_qualite (appareil_id, type, date_realisation, date_echeance, controle_externe_id, organisme, realise_par, statut, observations)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            appareil_id,
            type_,
            date_realisation,
            date_echeance,
            controle_externe_id,
            organisme,
            realise_par,
            statut,
            observations,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub async fn controle_qualite_update(
    id: i64,
    appareil_id: i64,
    type_: String,
    date_realisation: Option<String>,
    date_echeance: String,
    controle_externe_id: Option<i64>,
    organisme: Option<String>,
    realise_par: Option<String>,
    statut: String,
    observations: Option<String>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    crate::validators::validate_date(&date_echeance)?;
    if let Some(ref d) = date_realisation { crate::validators::validate_date(d)?; }
    let conn = state.get()?;
    conn.execute(
        "UPDATE controle_qualite SET appareil_id = ?1, type = ?2, date_realisation = ?3, date_echeance = ?4, controle_externe_id = ?5, organisme = ?6, realise_par = ?7, statut = ?8, observations = ?9 WHERE id = ?10",
        rusqlite::params![
            appareil_id,
            type_,
            date_realisation,
            date_echeance,
            controle_externe_id,
            organisme,
            realise_par,
            statut,
            observations,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn controle_qualite_delete(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<(), String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    conn.execute("DELETE FROM controle_qualite WHERE id = ?1", [id])
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
    fn test_trg_generer_cq_internes() {
        let conn = init_test_db();

        conn.execute(
            "INSERT INTO etablissement (denomination) VALUES (?1)",
            rusqlite::params!["Test Etab"],
        )
        .expect("Failed to insert etablissement");

        conn.execute(
            "INSERT INTO appareil (etablissement_id, designation, utilisation_partagee) VALUES (?1, ?2, ?3)",
            rusqlite::params![1i64, "Test Device", 0i64],
        )
        .expect("Failed to insert appareil");

        conn.execute(
            "INSERT INTO controle_qualite (appareil_id, type, date_echeance, statut)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                1i64,
                "externe",
                "2026-01-15",
                "planifie",
            ],
        )
        .expect("Failed to insert CQ externe");

        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM controle_qualite WHERE appareil_id = ?1 AND type IN ('partiel_interne', 'complet_interne')")
            .expect("Failed to prepare count");

        let count: i64 = stmt
            .query_row([1i64], |row| row.get(0))
            .expect("Failed to count");

        assert_eq!(count, 3, "Should have 3 internal CQ generated by trigger");

        let mut stmt = conn
            .prepare(
                "SELECT type, date_echeance FROM controle_qualite
                 WHERE appareil_id = ?1 AND type IN ('partiel_interne', 'complet_interne')
                 ORDER BY date_echeance"
            )
            .expect("Failed to prepare fetch");

        let internal_cqs: Vec<(String, String)> = stmt
            .query_map([1i64], |row| Ok((row.get(0)?, row.get(1)?)))
            .expect("Failed to query")
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(internal_cqs.len(), 3);

        assert_eq!(internal_cqs[0].0, "partiel_interne");
        assert_eq!(internal_cqs[0].1, "2026-04-15");

        assert_eq!(internal_cqs[1].0, "complet_interne");
        assert_eq!(internal_cqs[1].1, "2026-07-15");

        assert_eq!(internal_cqs[2].0, "partiel_interne");
        assert_eq!(internal_cqs[2].1, "2026-10-15");

        let mut stmt = conn
            .prepare("SELECT controle_externe_id FROM controle_qualite WHERE appareil_id = ?1 AND type IN ('partiel_interne', 'complet_interne')")
            .expect("Failed to prepare external ref");

        let external_refs: Vec<i64> = stmt
            .query_map([1i64], |row| row.get(0))
            .expect("Failed to query")
            .filter_map(|r| r.ok())
            .collect();

        for external_ref in external_refs {
            assert_eq!(external_ref, 1, "All internal CQ should reference external CQ id=1");
        }
    }
}
