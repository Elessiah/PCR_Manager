use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

// ────────────────────────────────────────────────────────────────────────────
// Types partagés export / import
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPayload {
    pub version: u32,
    pub exported_at: String,
    pub travailleurs: Vec<serde_json::Value>,
    pub appareils: Vec<serde_json::Value>,
    pub competences: Vec<serde_json::Value>,
    pub habilitations: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub travailleurs_added: usize,
    pub appareils_added: usize,
}

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn data_export(state: tauri::State<'_, DbState>) -> Result<String, String> {
    let conn = state.conn.lock();

    // Travailleurs
    let mut stmt = conn
        .prepare(
            "SELECT id, etablissement_id, nom, prenom, sexe, date_naissance, \
             lieu_naissance, pays_naissance, fonction, date_debut_activite, \
             categorie_reglementaire, numero_adeli_rpps, email, telephone, \
             numero_securite_sociale, numero_porteur_dosimetrie_passive, \
             numero_suivi_medical FROM travailleur",
        )
        .map_err(|e| e.to_string())?;

    let travailleurs: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "etablissement_id": row.get::<_, i64>(1)?,
                "nom": row.get::<_, String>(2)?,
                "prenom": row.get::<_, String>(3)?,
                "sexe": row.get::<_, Option<String>>(4)?,
                "date_naissance": row.get::<_, Option<String>>(5)?,
                "lieu_naissance": row.get::<_, Option<String>>(6)?,
                "pays_naissance": row.get::<_, Option<String>>(7)?,
                "fonction": row.get::<_, Option<String>>(8)?,
                "date_debut_activite": row.get::<_, Option<String>>(9)?,
                "categorie_reglementaire": row.get::<_, Option<String>>(10)?,
                "numero_adeli_rpps": row.get::<_, Option<String>>(11)?,
                "email": row.get::<_, Option<String>>(12)?,
                "telephone": row.get::<_, Option<String>>(13)?,
                "numero_securite_sociale": row.get::<_, Option<String>>(14)?,
                "numero_porteur_dosimetrie_passive": row.get::<_, Option<String>>(15)?,
                "numero_suivi_medical": row.get::<_, Option<String>>(16)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Appareils
    let mut stmt = conn
        .prepare(
            "SELECT id, etablissement_id, designation, marque, modele, numero_serie, \
             type_, annee_mise_en_service, lieu_utilisation, utilisation_partagee, \
             tension_nominale_kv, intensite_maximale_ma FROM appareil",
        )
        .map_err(|e| e.to_string())?;

    let appareils: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "etablissement_id": row.get::<_, i64>(1)?,
                "designation": row.get::<_, String>(2)?,
                "marque": row.get::<_, Option<String>>(3)?,
                "modele": row.get::<_, Option<String>>(4)?,
                "numero_serie": row.get::<_, Option<String>>(5)?,
                "type_": row.get::<_, Option<String>>(6)?,
                "annee_mise_en_service": row.get::<_, Option<i64>>(7)?,
                "lieu_utilisation": row.get::<_, Option<String>>(8)?,
                "utilisation_partagee": row.get::<_, i64>(9)?,
                "tension_nominale_kv": row.get::<_, Option<f64>>(10)?,
                "intensite_maximale_ma": row.get::<_, Option<f64>>(11)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Compétences (inclut description ajoutée en V3)
    let mut stmt = conn
        .prepare("SELECT id, libelle, ordre, description FROM competence_ref ORDER BY ordre")
        .map_err(|e| e.to_string())?;

    let competences: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "libelle": row.get::<_, String>(1)?,
                "ordre": row.get::<_, i64>(2)?,
                "description": row.get::<_, Option<String>>(3)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Habilitations
    let mut stmt = conn
        .prepare(
            "SELECT id, travailleur_id, dosimetrie_passive_date, \
             dosimetrie_operationnelle_date, formation_rp_travailleurs_date, \
             formation_rp_patients_date, visite_medicale_date FROM habilitation",
        )
        .map_err(|e| e.to_string())?;

    let habilitations: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "travailleur_id": row.get::<_, i64>(1)?,
                "dosimetrie_passive_date": row.get::<_, Option<String>>(2)?,
                "dosimetrie_operationnelle_date": row.get::<_, Option<String>>(3)?,
                "formation_rp_travailleurs_date": row.get::<_, Option<String>>(4)?,
                "formation_rp_patients_date": row.get::<_, Option<String>>(5)?,
                "visite_medicale_date": row.get::<_, Option<String>>(6)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let payload = ExportPayload {
        version: 1,
        exported_at: Utc::now().to_rfc3339(),
        travailleurs,
        appareils,
        competences,
        habilitations,
    };

    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

// ────────────────────────────────────────────────────────────────────────────
// Import — paramètres rusqlite corrects (pas de string-formatting SQL)
// ────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn data_import(
    state: tauri::State<'_, DbState>,
    json_str: String,
) -> Result<ImportResult, String> {
    let payload: ExportPayload =
        serde_json::from_str(&json_str).map_err(|e| format!("JSON invalide : {}", e))?;

    if payload.version != 1 {
        return Err(format!(
            "Version d'export non supportée : {}",
            payload.version
        ));
    }

    let mut conn = state.conn.lock();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut travailleurs_added = 0usize;
    let mut appareils_added = 0usize;

    // ── Travailleurs ────────────────────────────────────────────────────────
    for t in &payload.travailleurs {
        let rows = tx
            .execute(
                "INSERT OR IGNORE INTO travailleur \
                 (id, etablissement_id, nom, prenom, sexe, date_naissance, \
                  lieu_naissance, pays_naissance, fonction, date_debut_activite, \
                  categorie_reglementaire, numero_adeli_rpps, email, telephone, \
                  numero_securite_sociale, numero_porteur_dosimetrie_passive, \
                  numero_suivi_medical) \
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
                rusqlite::params![
                    t["id"].as_i64(),
                    t["etablissement_id"].as_i64(),
                    t["nom"].as_str(),
                    t["prenom"].as_str(),
                    t["sexe"].as_str(),
                    t["date_naissance"].as_str(),
                    t["lieu_naissance"].as_str(),
                    t["pays_naissance"].as_str(),
                    t["fonction"].as_str(),
                    t["date_debut_activite"].as_str(),
                    t["categorie_reglementaire"].as_str(),
                    t["numero_adeli_rpps"].as_str(),
                    t["email"].as_str(),
                    t["telephone"].as_str(),
                    t["numero_securite_sociale"].as_str(),
                    t["numero_porteur_dosimetrie_passive"].as_str(),
                    t["numero_suivi_medical"].as_str(),
                ],
            )
            .map_err(|e| e.to_string())?;
        travailleurs_added += rows;
    }

    // ── Appareils ───────────────────────────────────────────────────────────
    for a in &payload.appareils {
        let rows = tx
            .execute(
                "INSERT OR IGNORE INTO appareil \
                 (id, etablissement_id, designation, marque, modele, numero_serie, \
                  type_, annee_mise_en_service, lieu_utilisation, utilisation_partagee, \
                  tension_nominale_kv, intensite_maximale_ma) \
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                rusqlite::params![
                    a["id"].as_i64(),
                    a["etablissement_id"].as_i64(),
                    a["designation"].as_str(),
                    a["marque"].as_str(),
                    a["modele"].as_str(),
                    a["numero_serie"].as_str(),
                    a["type_"].as_str(),
                    a["annee_mise_en_service"].as_i64(),
                    a["lieu_utilisation"].as_str(),
                    a["utilisation_partagee"].as_i64(),
                    a["tension_nominale_kv"].as_f64(),
                    a["intensite_maximale_ma"].as_f64(),
                ],
            )
            .map_err(|e| e.to_string())?;
        appareils_added += rows;
    }

    // ── Compétences ─────────────────────────────────────────────────────────
    for c in &payload.competences {
        tx.execute(
            "INSERT OR IGNORE INTO competence_ref (id, libelle, ordre, description) \
             VALUES (?1,?2,?3,?4)",
            rusqlite::params![
                c["id"].as_i64(),
                c["libelle"].as_str(),
                c["ordre"].as_i64(),
                c["description"].as_str(),
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // ── Habilitations ───────────────────────────────────────────────────────
    for h in &payload.habilitations {
        tx.execute(
            "INSERT OR IGNORE INTO habilitation \
             (id, travailleur_id, dosimetrie_passive_date, dosimetrie_operationnelle_date, \
              formation_rp_travailleurs_date, formation_rp_patients_date, visite_medicale_date) \
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![
                h["id"].as_i64(),
                h["travailleur_id"].as_i64(),
                h["dosimetrie_passive_date"].as_str(),
                h["dosimetrie_operationnelle_date"].as_str(),
                h["formation_rp_travailleurs_date"].as_str(),
                h["formation_rp_patients_date"].as_str(),
                h["visite_medicale_date"].as_str(),
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ImportResult {
        travailleurs_added,
        appareils_added,
    })
}
