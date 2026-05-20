use crate::db::{DbState, log_acces};
use crate::models::{Travailleur, JournalAcces};
use crate::auth_totp;

#[tauri::command]
pub async fn travailleur_list(session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<Travailleur>, String> {
    ensure_authenticated(&session)?;
    let conn = state.get()?;
    log_acces(&conn, "LECTURE", "travailleur", None, true);
    let mut stmt = conn
        .prepare("SELECT id, etablissement_id, nom, prenom, sexe, date_naissance, lieu_naissance, pays_naissance, fonction, date_debut_activite, categorie_reglementaire, numero_adeli_rpps, email, telephone, numero_securite_sociale, numero_porteur_dosimetrie_passive, numero_suivi_medical, created_at, updated_at FROM travailleur ORDER BY id")
        .map_err(|e| e.to_string())?;

    let travailleurs = stmt
        .query_map([], |row| {
            Ok(Travailleur {
                id: row.get(0)?,
                etablissement_id: row.get(1)?,
                nom: row.get(2)?,
                prenom: row.get(3)?,
                sexe: row.get(4)?,
                date_naissance: row.get(5)?,
                lieu_naissance: row.get(6)?,
                pays_naissance: row.get(7)?,
                fonction: row.get(8)?,
                date_debut_activite: row.get(9)?,
                categorie_reglementaire: row.get(10)?,
                numero_adeli_rpps: row.get(11)?,
                email: row.get(12)?,
                telephone: row.get(13)?,
                numero_securite_sociale: row.get(14)?,
                numero_porteur_dosimetrie_passive: row.get(15)?,
                numero_suivi_medical: row.get(16)?,
                created_at: row.get(17)?,
                updated_at: row.get(18)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(travailleurs)
}

#[tauri::command]
pub async fn travailleur_get(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Travailleur, String> {
    ensure_authenticated(&session)?;
    let conn = state.get()?;
    log_acces(&conn, "LECTURE", "travailleur", Some(id), true);
    let mut stmt = conn
        .prepare("SELECT id, etablissement_id, nom, prenom, sexe, date_naissance, lieu_naissance, pays_naissance, fonction, date_debut_activite, categorie_reglementaire, numero_adeli_rpps, email, telephone, numero_securite_sociale, numero_porteur_dosimetrie_passive, numero_suivi_medical, created_at, updated_at FROM travailleur WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let travailleur = stmt
        .query_row([id], |row| {
            Ok(Travailleur {
                id: row.get(0)?,
                etablissement_id: row.get(1)?,
                nom: row.get(2)?,
                prenom: row.get(3)?,
                sexe: row.get(4)?,
                date_naissance: row.get(5)?,
                lieu_naissance: row.get(6)?,
                pays_naissance: row.get(7)?,
                fonction: row.get(8)?,
                date_debut_activite: row.get(9)?,
                categorie_reglementaire: row.get(10)?,
                numero_adeli_rpps: row.get(11)?,
                email: row.get(12)?,
                telephone: row.get(13)?,
                numero_securite_sociale: row.get(14)?,
                numero_porteur_dosimetrie_passive: row.get(15)?,
                numero_suivi_medical: row.get(16)?,
                created_at: row.get(17)?,
                updated_at: row.get(18)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(travailleur)
}

#[tauri::command]
pub async fn travailleur_create(
    etablissement_id: i64,
    nom: String,
    prenom: String,
    sexe: Option<String>,
    date_naissance: Option<String>,
    lieu_naissance: Option<String>,
    pays_naissance: Option<String>,
    fonction: Option<String>,
    date_debut_activite: Option<String>,
    categorie_reglementaire: Option<String>,
    numero_adeli_rpps: Option<String>,
    email: Option<String>,
    telephone: Option<String>,
    numero_securite_sociale: Option<String>,
    numero_porteur_dosimetrie_passive: Option<String>,
    numero_suivi_medical: Option<String>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<i64, String> {
    ensure_authenticated(&session)?;
    if let Some(ref nss) = numero_securite_sociale {
        crate::validators::validate_nss(nss)?;
    }
    if let Some(ref e) = email {
        crate::validators::validate_email(e)?;
    }
    if let Some(ref d) = date_naissance {
        crate::validators::validate_date(d)?;
    }
    let conn = state.get()?;
    conn.execute(
        "INSERT INTO travailleur (etablissement_id, nom, prenom, sexe, date_naissance, lieu_naissance, pays_naissance, fonction, date_debut_activite, categorie_reglementaire, numero_adeli_rpps, email, telephone, numero_securite_sociale, numero_porteur_dosimetrie_passive, numero_suivi_medical)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        rusqlite::params![
            etablissement_id,
            nom,
            prenom,
            sexe,
            date_naissance,
            lieu_naissance,
            pays_naissance,
            fonction,
            date_debut_activite,
            categorie_reglementaire,
            numero_adeli_rpps,
            email,
            telephone,
            numero_securite_sociale,
            numero_porteur_dosimetrie_passive,
            numero_suivi_medical,
        ],
    )
    .map_err(|e| e.to_string())?;

    let new_id = conn.last_insert_rowid();
    log_acces(&conn, "CREATION", "travailleur", Some(new_id), numero_securite_sociale.is_some());
    Ok(new_id)
}

#[tauri::command]
pub async fn travailleur_update(
    id: i64,
    etablissement_id: i64,
    nom: String,
    prenom: String,
    sexe: Option<String>,
    date_naissance: Option<String>,
    lieu_naissance: Option<String>,
    pays_naissance: Option<String>,
    fonction: Option<String>,
    date_debut_activite: Option<String>,
    categorie_reglementaire: Option<String>,
    numero_adeli_rpps: Option<String>,
    email: Option<String>,
    telephone: Option<String>,
    numero_securite_sociale: Option<String>,
    numero_porteur_dosimetrie_passive: Option<String>,
    numero_suivi_medical: Option<String>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    ensure_authenticated(&session)?;
    if let Some(ref nss) = numero_securite_sociale {
        crate::validators::validate_nss(nss)?;
    }
    if let Some(ref e) = email {
        crate::validators::validate_email(e)?;
    }
    if let Some(ref d) = date_naissance {
        crate::validators::validate_date(d)?;
    }
    let conn = state.get()?;
    log_acces(&conn, "MODIFICATION", "travailleur", Some(id), numero_securite_sociale.is_some());
    conn.execute(
        "UPDATE travailleur SET etablissement_id = ?1, nom = ?2, prenom = ?3, sexe = ?4, date_naissance = ?5, lieu_naissance = ?6, pays_naissance = ?7, fonction = ?8, date_debut_activite = ?9, categorie_reglementaire = ?10, numero_adeli_rpps = ?11, email = ?12, telephone = ?13, numero_securite_sociale = ?14, numero_porteur_dosimetrie_passive = ?15, numero_suivi_medical = ?16 WHERE id = ?17",
        rusqlite::params![
            etablissement_id,
            nom,
            prenom,
            sexe,
            date_naissance,
            lieu_naissance,
            pays_naissance,
            fonction,
            date_debut_activite,
            categorie_reglementaire,
            numero_adeli_rpps,
            email,
            telephone,
            numero_securite_sociale,
            numero_porteur_dosimetrie_passive,
            numero_suivi_medical,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn travailleur_delete(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<(), String> {
    ensure_authenticated(&session)?;
    let conn = state.get()?;
    log_acces(&conn, "SUPPRESSION", "travailleur", Some(id), false);
    conn.execute("DELETE FROM travailleur WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn ensure_authenticated(session: &auth_totp::SessionState) -> Result<(), String> {
    if !*session.authenticated.lock() {
        return Err("Non authentifiÃ©".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn journal_acces_list(
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<JournalAcces>, String> {
    ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, horodatage, operation, entite, entite_id, champ_nir FROM journal_acces ORDER BY horodatage DESC LIMIT 500")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok(JournalAcces {
            id: row.get(0)?,
            horodatage: row.get(1)?,
            operation: row.get(2)?,
            entite: row.get(3)?,
            entite_id: row.get(4)?,
            champ_nir: row.get(5)?,
        }))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
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
    fn test_insert_and_list_travailleur() {
        let conn = init_test_db();

        conn.execute(
            "INSERT INTO etablissement (denomination) VALUES (?1)",
            rusqlite::params!["Test Etab"],
        )
        .expect("Failed to insert etablissement");

        conn.execute(
            "INSERT INTO travailleur (etablissement_id, nom, prenom, sexe, date_naissance, lieu_naissance, pays_naissance, fonction, date_debut_activite, categorie_reglementaire, numero_adeli_rpps, email, telephone, numero_securite_sociale, numero_porteur_dosimetrie_passive, numero_suivi_medical)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            rusqlite::params![
                1i64,
                "Dupont",
                "Jean",
                Some("M"),
                Some("1980-01-15"),
                Some("Paris"),
                Some("France"),
                Some("Cardiologue"),
                Some("2020-06-01"),
                Some("A"),
                Some("12345678"),
                Some("jean@test.fr"),
                Some("0612345678"),
                Some("1234567890123"),
                Some("DP123456"),
                Some("SM123456"),
            ],
        )
        .expect("Failed to insert travailleur");

        let mut stmt = conn
            .prepare("SELECT id, etablissement_id, nom, prenom FROM travailleur WHERE id = ?1")
            .expect("Failed to prepare");

        let (id, etab_id, nom, prenom): (i64, i64, String, String) = stmt
            .query_row([1i64], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
            .expect("Failed to query");

        assert_eq!(id, 1);
        assert_eq!(etab_id, 1);
        assert_eq!(nom, "Dupont");
        assert_eq!(prenom, "Jean");
    }

    #[test]
    fn test_remove_travailleur() {
        let conn = init_test_db();

        conn.execute(
            "INSERT INTO etablissement (denomination) VALUES (?1)",
            rusqlite::params!["Test Etab"],
        )
        .expect("Failed to insert etablissement");

        conn.execute(
            "INSERT INTO travailleur (etablissement_id, nom, prenom)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![1i64, "Test", "Worker"],
        )
        .expect("Failed to insert travailleur");

        conn.execute("DELETE FROM travailleur WHERE id = ?1", [1i64])
            .expect("Failed to delete");

        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM travailleur")
            .expect("Failed to prepare");

        let count: i64 = stmt
            .query_row([], |row| row.get(0))
            .expect("Failed to query");

        assert_eq!(count, 0);
    }
}
