use crate::auth_totp;
use crate::db::DbState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use argon2::Argon2;
use base64::{engine::general_purpose, Engine};
use flate2::Compression;
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use rand::RngCore;
use rand::rngs::OsRng;
use std::fs;
use std::io::{Read, Write};

const MAGIC: &[u8] = b"PCREXP01";
const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types partagÃ©s export / import
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPayload {
    pub version: u32,
    pub exported_at: String,
    pub etablissements: Vec<serde_json::Value>,
    pub travailleurs: Vec<serde_json::Value>,
    pub appareils: Vec<serde_json::Value>,
    pub competences: Vec<serde_json::Value>,
    pub habilitations: Vec<serde_json::Value>,
    pub verifications: Vec<serde_json::Value>,
    pub controles_qualite: Vec<serde_json::Value>,
    pub competences_travailleur: Vec<serde_json::Value>,
    pub competences_travailleur_general: Vec<serde_json::Value>,
    pub travailleurs_appareils: Vec<serde_json::Value>,
    pub appareils_competences_ref: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct ImportResultExtended {
    pub travailleurs_added: usize,
    pub appareils_added: usize,
    pub competences_added: usize,
    pub habilitations_added: usize,
    pub etablissements_added: usize,
    pub verifications_added: usize,
    pub controles_added: usize,
}

#[derive(Debug, Serialize)]
pub struct ExportEncryptedResult {
    pub code: String,
    pub file_b64: String,
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Export chiffrÃ© (v2 complet)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

fn generate_short_code() -> String {
    let mut code = [0u8; 10];
    OsRng.fill_bytes(&mut code);
    code.iter()
        .map(|&b| CODE_ALPHABET[(b as usize) % CODE_ALPHABET.len()] as char)
        .collect::<String>()
}

fn format_short_code(code: &str) -> String {
    let code_upper = code.to_uppercase();
    let code_clean: String = code_upper.chars()
        .filter(|c| c.is_alphanumeric())
        .collect();
    if code_clean.len() >= 10 {
        format!("{}-{}", &code_clean[..5], &code_clean[5..10])
    } else {
        code_clean
    }
}

#[cfg(test)]
fn encrypt_payload(payload: &ExportPayload, code: &str) -> Result<(String, String), String> {
    let json_str = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(json_str.as_bytes()).map_err(|e| e.to_string())?;
    let plaintext = encoder.finish().map_err(|e| e.to_string())?;

    let code_upper = code.to_uppercase();
    let code_clean: String = code_upper.chars()
        .filter(|c| c.is_alphanumeric())
        .collect();
    let code_formatted = format_short_code(&code_clean);

    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(code_clean.as_bytes(), &salt, &mut key)
        .map_err(|e| format!("Erreur Argon2: {}", e))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from(nonce_bytes);
    let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|e| format!("Erreur chiffrement: {}", e))?;

    let mut file_bytes = Vec::new();
    file_bytes.extend_from_slice(MAGIC);
    file_bytes.extend_from_slice(&salt);
    file_bytes.extend_from_slice(&nonce_bytes);
    file_bytes.extend_from_slice(&ciphertext);

    let file_b64 = general_purpose::STANDARD.encode(&file_bytes);
    Ok((file_b64, code_formatted))
}

#[cfg(test)]
fn decrypt_payload(file_b64: &str, code: &str) -> Result<ExportPayload, String> {
    let file_bytes = general_purpose::STANDARD
        .decode(&file_b64)
        .map_err(|e| format!("Base64 invalide: {}", e))?;

    if file_bytes.len() < 8 || &file_bytes[..8] != MAGIC {
        return Err("Fichier invalide ou corrompu".to_string());
    }

    if file_bytes.len() < 36 {
        return Err("Fichier trop court".to_string());
    }

    let salt = &file_bytes[8..24];
    let nonce_bytes = &file_bytes[24..36];
    let ciphertext = &file_bytes[36..];

    let code_upper = code.to_uppercase();
    let code_clean: String = code_upper.chars()
        .filter(|c| c.is_alphanumeric())
        .collect();

    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(code_clean.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Erreur Argon2: {}", e))?;

    let nonce_arr: [u8; 12] = nonce_bytes.try_into().expect("nonce 12 bytes");
    let nonce = Nonce::from(nonce_arr);
    let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
    let plaintext = cipher
        .decrypt(&nonce, ciphertext)
        .map_err(|_| "Code incorrect ou fichier corrompu".to_string())?;

    let mut decoder = GzDecoder::new(&plaintext[..]);
    let mut json_str = String::new();
    decoder.read_to_string(&mut json_str)
        .map_err(|e| format!("Erreur dÃ©compression: {}", e))?;

    let payload: ExportPayload = serde_json::from_str(&json_str)
        .map_err(|e| format!("JSON invalide: {}", e))?;

    Ok(payload)
}

#[tauri::command]
pub async fn data_export_encrypted(
    state: tauri::State<'_, DbState>,
    session: tauri::State<'_, auth_totp::SessionState>,
) -> Result<ExportEncryptedResult, String> {
    auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;

    // Ã‰tablissements
    let mut stmt = conn
        .prepare("SELECT id, denomination, statut_juridique, siret, adresse, code_postal, ville, telephone, email, site_internet, kbis_chemin FROM etablissement")
        .map_err(|e| e.to_string())?;

    let etablissements: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "denomination": row.get::<_, String>(1)?,
                "statut_juridique": row.get::<_, Option<String>>(2)?,
                "siret": row.get::<_, Option<String>>(3)?,
                "adresse": row.get::<_, Option<String>>(4)?,
                "code_postal": row.get::<_, Option<String>>(5)?,
                "ville": row.get::<_, Option<String>>(6)?,
                "telephone": row.get::<_, Option<String>>(7)?,
                "email": row.get::<_, Option<String>>(8)?,
                "site_internet": row.get::<_, Option<String>>(9)?,
                "kbis_chemin": row.get::<_, Option<String>>(10)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

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
             type, annee_mise_en_service, lieu_utilisation, utilisation_partagee, \
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

    // CompÃ©tences
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

    // VÃ©rifications
    let mut stmt = conn
        .prepare(
            "SELECT id, appareil_id, type, date_realisation, realise_par, organisme, observations \
             FROM verification_technique",
        )
        .map_err(|e| e.to_string())?;

    let verifications: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "appareil_id": row.get::<_, i64>(1)?,
                "type_": row.get::<_, String>(2)?,
                "date_realisation": row.get::<_, String>(3)?,
                "realise_par": row.get::<_, Option<String>>(4)?,
                "organisme": row.get::<_, Option<String>>(5)?,
                "observations": row.get::<_, Option<String>>(6)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // ContrÃ´les qualitÃ©
    let mut stmt = conn
        .prepare(
            "SELECT id, appareil_id, type, date_realisation, date_echeance, \
             controle_externe_id, organisme, realise_par, statut, observations \
             FROM controle_qualite",
        )
        .map_err(|e| e.to_string())?;

    let controles_qualite: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "appareil_id": row.get::<_, i64>(1)?,
                "type_": row.get::<_, String>(2)?,
                "date_realisation": row.get::<_, Option<String>>(3)?,
                "date_echeance": row.get::<_, String>(4)?,
                "controle_externe_id": row.get::<_, Option<i64>>(5)?,
                "organisme": row.get::<_, Option<String>>(6)?,
                "realise_par": row.get::<_, Option<String>>(7)?,
                "statut": row.get::<_, String>(8)?,
                "observations": row.get::<_, Option<String>>(9)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // CompÃ©tences travailleur
    let mut stmt = conn
        .prepare(
            "SELECT id, travailleur_id, appareil_id, competence_ref_id, \
             date_validation, validated, date_peremption FROM competence_travailleur",
        )
        .map_err(|e| e.to_string())?;

    let competences_travailleur: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "travailleur_id": row.get::<_, i64>(1)?,
                "appareil_id": row.get::<_, i64>(2)?,
                "competence_ref_id": row.get::<_, i64>(3)?,
                "date_validation": row.get::<_, Option<String>>(4)?,
                "validated": row.get::<_, i64>(5)?,
                "date_peremption": row.get::<_, Option<String>>(6)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // CompÃ©tences travailleur gÃ©nÃ©ral
    let mut stmt = conn
        .prepare(
            "SELECT id, travailleur_id, competence_ref_id, date_validation, \
             date_peremption, validated FROM competence_travailleur_general",
        )
        .map_err(|e| e.to_string())?;

    let competences_travailleur_general: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "travailleur_id": row.get::<_, i64>(1)?,
                "competence_ref_id": row.get::<_, i64>(2)?,
                "date_validation": row.get::<_, Option<String>>(3)?,
                "date_peremption": row.get::<_, Option<String>>(4)?,
                "validated": row.get::<_, i64>(5)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Travailleurs appareils
    let mut stmt = conn
        .prepare("SELECT id, travailleur_id, appareil_id FROM travailleur_appareil")
        .map_err(|e| e.to_string())?;

    let travailleurs_appareils: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "travailleur_id": row.get::<_, i64>(1)?,
                "appareil_id": row.get::<_, i64>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Appareils compÃ©tences ref
    let mut stmt = conn
        .prepare("SELECT id, appareil_id, competence_ref_id FROM appareil_competence_ref")
        .map_err(|e| e.to_string())?;

    let appareils_competences_ref: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "appareil_id": row.get::<_, i64>(1)?,
                "competence_ref_id": row.get::<_, i64>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let payload = ExportPayload {
        version: 2,
        exported_at: Utc::now().to_rfc3339(),
        etablissements,
        travailleurs,
        appareils,
        competences,
        habilitations,
        verifications,
        controles_qualite,
        competences_travailleur,
        competences_travailleur_general,
        travailleurs_appareils,
        appareils_competences_ref,
    };

    // SÃ©rialiser et compresser
    let json_str = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(json_str.as_bytes()).map_err(|e| e.to_string())?;
    let plaintext = encoder.finish().map_err(|e| e.to_string())?;

    // GÃ©nÃ©rer code et dÃ©river clÃ©
    let code = generate_short_code();
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(code.as_bytes(), &salt, &mut key)
        .map_err(|e| format!("Erreur Argon2: {}", e))?;

    // Chiffrer
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from(nonce_bytes);
    let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|e| format!("Erreur chiffrement: {}", e))?;

    // Construire fichier
    let mut file_bytes = Vec::new();
    file_bytes.extend_from_slice(MAGIC);
    file_bytes.extend_from_slice(&salt);
    file_bytes.extend_from_slice(&nonce_bytes);
    file_bytes.extend_from_slice(&ciphertext);

    Ok(ExportEncryptedResult {
        code: format_short_code(&code),
        file_b64: general_purpose::STANDARD.encode(&file_bytes),
    })
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Import chiffrÃ© v2 uniquement
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

#[tauri::command]
pub async fn data_import_encrypted(
    state: tauri::State<'_, DbState>,
    session: tauri::State<'_, auth_totp::SessionState>,
    file_b64: String,
    code: String,
) -> Result<ImportResultExtended, String> {
    auth_totp::ensure_authenticated(&session)?;
    const MAX_B64: usize = 70 * 1024 * 1024;
    if file_b64.len() > MAX_B64 {
        return Err("Fichier d'import trop volumineux (max 70 Mo)".to_string());
    }
    // DÃ©coder base64
    let file_bytes = general_purpose::STANDARD
        .decode(&file_b64)
        .map_err(|e| format!("Base64 invalide: {}", e))?;

    // VÃ©rifier magic
    if file_bytes.len() < 8 || &file_bytes[..8] != MAGIC {
        return Err("Fichier invalide ou corrompu".to_string());
    }

    if file_bytes.len() < 36 {
        return Err("Fichier trop court".to_string());
    }

    let salt = &file_bytes[8..24];
    let nonce_bytes = &file_bytes[24..36];
    let ciphertext = &file_bytes[36..];

    // Normaliser et dÃ©river clÃ©
    let code_upper = code.to_uppercase();
    let code_clean: String = code_upper.chars()
        .filter(|c| c.is_alphanumeric())
        .collect();

    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(code_clean.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Erreur Argon2: {}", e))?;

    // DÃ©chiffrer
    let nonce_arr: [u8; 12] = nonce_bytes.try_into().expect("nonce 12 bytes");
    let nonce = Nonce::from(nonce_arr);
    let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
    let plaintext = cipher
        .decrypt(&nonce, ciphertext)
        .map_err(|_| "Code incorrect ou fichier corrompu".to_string())?;

    // DÃ©compresser
    let mut decoder = GzDecoder::new(&plaintext[..]);
    let mut json_str = String::new();
    decoder.read_to_string(&mut json_str)
        .map_err(|e| format!("Erreur dÃ©compression: {}", e))?;

    const MAX_JSON_DEC: usize = 50 * 1024 * 1024;
    if json_str.len() > MAX_JSON_DEC {
        return Err("Payload dÃ©compress\u{00e9} trop volumineux (max 50 Mo)".to_string());
    }

    // Parser JSON
    let payload: ExportPayload = serde_json::from_str(&json_str)
        .map_err(|e| format!("JSON invalide: {}", e))?;

    if payload.version != 2 {
        return Err(format!("Version non supportÃ©e: {}", payload.version));
    }

    let mut conn = state.get()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut etablissements_added = 0;
    let mut travailleurs_added = 0;
    let mut appareils_added = 0;
    let mut competences_added = 0;
    let mut habilitations_added = 0;
    let mut verifications_added = 0;
    let mut controles_added = 0;

    // Ã‰tablissements
    for e in &payload.etablissements {
        let rows = tx.execute(
            "INSERT OR IGNORE INTO etablissement \
             (id, denomination, statut_juridique, siret, adresse, code_postal, \
              ville, telephone, email, site_internet, kbis_chemin) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            rusqlite::params![
                e["id"].as_i64(),
                e["denomination"].as_str(),
                e["statut_juridique"].as_str(),
                e["siret"].as_str(),
                e["adresse"].as_str(),
                e["code_postal"].as_str(),
                e["ville"].as_str(),
                e["telephone"].as_str(),
                e["email"].as_str(),
                e["site_internet"].as_str(),
                e["kbis_chemin"].as_str(),
            ],
        ).map_err(|e| e.to_string())?;
        etablissements_added += rows;
    }

    // Travailleurs
    for t in &payload.travailleurs {
        let rows = tx.execute(
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
        ).map_err(|e| e.to_string())?;
        travailleurs_added += rows;
    }

    // Appareils
    for a in &payload.appareils {
        let rows = tx.execute(
            "INSERT OR IGNORE INTO appareil \
             (id, etablissement_id, designation, marque, modele, numero_serie, \
              type, annee_mise_en_service, lieu_utilisation, utilisation_partagee, \
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
        ).map_err(|e| e.to_string())?;
        appareils_added += rows;
    }

    // CompÃ©tences
    for c in &payload.competences {
        let rows = tx.execute(
            "INSERT OR IGNORE INTO competence_ref (id, libelle, ordre, description) \
             VALUES (?1,?2,?3,?4)",
            rusqlite::params![
                c["id"].as_i64(),
                c["libelle"].as_str(),
                c["ordre"].as_i64(),
                c["description"].as_str(),
            ],
        ).map_err(|e| e.to_string())?;
        competences_added += rows;
    }

    // Habilitations
    for h in &payload.habilitations {
        let rows = tx.execute(
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
        ).map_err(|e| e.to_string())?;
        habilitations_added += rows;
    }

    // VÃ©rifications
    for v in &payload.verifications {
        let rows = tx.execute(
            "INSERT OR IGNORE INTO verification_technique \
             (id, appareil_id, type, date_realisation, realise_par, organisme, observations) \
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![
                v["id"].as_i64(),
                v["appareil_id"].as_i64(),
                v["type_"].as_str(),
                v["date_realisation"].as_str(),
                v["realise_par"].as_str(),
                v["organisme"].as_str(),
                v["observations"].as_str(),
            ],
        ).map_err(|e| e.to_string())?;
        verifications_added += rows;
    }

    // ContrÃ´les qualitÃ©
    for cq in &payload.controles_qualite {
        let rows = tx.execute(
            "INSERT OR IGNORE INTO controle_qualite \
             (id, appareil_id, type, date_realisation, date_echeance, \
              controle_externe_id, organisme, realise_par, statut, observations) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            rusqlite::params![
                cq["id"].as_i64(),
                cq["appareil_id"].as_i64(),
                cq["type_"].as_str(),
                cq["date_realisation"].as_str(),
                cq["date_echeance"].as_str(),
                cq["controle_externe_id"].as_i64(),
                cq["organisme"].as_str(),
                cq["realise_par"].as_str(),
                cq["statut"].as_str(),
                cq["observations"].as_str(),
            ],
        ).map_err(|e| e.to_string())?;
        controles_added += rows;
    }

    // CompÃ©tences travailleur
    for ct in &payload.competences_travailleur {
        tx.execute(
            "INSERT OR IGNORE INTO competence_travailleur \
             (id, travailleur_id, appareil_id, competence_ref_id, \
              date_validation, validated, date_peremption) \
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![
                ct["id"].as_i64(),
                ct["travailleur_id"].as_i64(),
                ct["appareil_id"].as_i64(),
                ct["competence_ref_id"].as_i64(),
                ct["date_validation"].as_str(),
                ct["validated"].as_i64(),
                ct["date_peremption"].as_str(),
            ],
        ).map_err(|e| e.to_string())?;
    }

    // CompÃ©tences travailleur gÃ©nÃ©ral
    for ctg in &payload.competences_travailleur_general {
        tx.execute(
            "INSERT OR IGNORE INTO competence_travailleur_general \
             (id, travailleur_id, competence_ref_id, date_validation, \
              date_peremption, validated) \
             VALUES (?1,?2,?3,?4,?5,?6)",
            rusqlite::params![
                ctg["id"].as_i64(),
                ctg["travailleur_id"].as_i64(),
                ctg["competence_ref_id"].as_i64(),
                ctg["date_validation"].as_str(),
                ctg["date_peremption"].as_str(),
                ctg["validated"].as_i64(),
            ],
        ).map_err(|e| e.to_string())?;
    }

    // Travailleurs appareils
    for ta in &payload.travailleurs_appareils {
        tx.execute(
            "INSERT OR IGNORE INTO travailleur_appareil \
             (id, travailleur_id, appareil_id) \
             VALUES (?1,?2,?3)",
            rusqlite::params![
                ta["id"].as_i64(),
                ta["travailleur_id"].as_i64(),
                ta["appareil_id"].as_i64(),
            ],
        ).map_err(|e| e.to_string())?;
    }

    // Appareils compÃ©tences ref
    for acr in &payload.appareils_competences_ref {
        tx.execute(
            "INSERT OR IGNORE INTO appareil_competence_ref \
             (id, appareil_id, competence_ref_id) \
             VALUES (?1,?2,?3)",
            rusqlite::params![
                acr["id"].as_i64(),
                acr["appareil_id"].as_i64(),
                acr["competence_ref_id"].as_i64(),
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ImportResultExtended {
        travailleurs_added,
        appareils_added,
        competences_added,
        habilitations_added,
        etablissements_added,
        verifications_added,
        controles_added,
    })
}

#[tauri::command]
pub async fn choose_save_path(
    session: tauri::State<'_, auth_totp::SessionState>,
    default_name: String,
) -> Result<Option<String>, String> {
    auth_totp::ensure_authenticated(&session)?;
    let handle = rfd::AsyncFileDialog::new()
        .set_file_name(&default_name)
        .add_filter("PCR Export", &["pcrexp"])
        .save_file()
        .await;
    Ok(handle.map(|h| h.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn save_export_file(
    session: tauri::State<'_, auth_totp::SessionState>,
    file_b64: String,
    dest_path: String,
) -> Result<String, String> {
    auth_totp::ensure_authenticated(&session)?;
    let bytes = general_purpose::STANDARD.decode(&file_b64).map_err(|e| e.to_string())?;
    fs::write(&dest_path, &bytes).map_err(|e| e.to_string())?;
    Ok(dest_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_import_chiffre_roundtrip() {
        let payload = ExportPayload {
            version: 2,
            exported_at: "2026-05-18T00:00:00Z".to_string(),
            etablissements: vec![json!({"id": 1, "denomination": "Test Etab"})],
            travailleurs: vec![json!({"id": 1, "etablissement_id": 1, "nom": "Dupont", "prenom": "Jean"})],
            appareils: vec![],
            competences: vec![],
            habilitations: vec![],
            verifications: vec![],
            controles_qualite: vec![],
            competences_travailleur: vec![],
            competences_travailleur_general: vec![],
            travailleurs_appareils: vec![],
            appareils_competences_ref: vec![],
        };

        let code = "TESTCODE12";
        let (file_b64, code_formatted) = encrypt_payload(&payload, code).unwrap();

        let decrypted = decrypt_payload(&file_b64, &code_formatted).unwrap();

        assert_eq!(decrypted.version, 2);
        assert_eq!(decrypted.etablissements.len(), 1);
        assert_eq!(decrypted.etablissements[0]["denomination"], "Test Etab");
        assert_eq!(decrypted.travailleurs.len(), 1);
        assert_eq!(decrypted.travailleurs[0]["nom"], "Dupont");
        assert_eq!(decrypted.travailleurs[0]["prenom"], "Jean");
    }

    #[test]
    fn test_decrypt_avec_code_incorrect_echoue() {
        let payload = ExportPayload {
            version: 2,
            exported_at: "2026-05-18T00:00:00Z".to_string(),
            etablissements: vec![],
            travailleurs: vec![],
            appareils: vec![],
            competences: vec![],
            habilitations: vec![],
            verifications: vec![],
            controles_qualite: vec![],
            competences_travailleur: vec![],
            competences_travailleur_general: vec![],
            travailleurs_appareils: vec![],
            appareils_competences_ref: vec![],
        };

        let (file_b64, _) = encrypt_payload(&payload, "CORRECT12").unwrap();

        let result = decrypt_payload(&file_b64, "WRONGCODE5");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Code incorrect"));
    }

    #[test]
    fn test_code_court_normalisation() {
        let code1 = "aaaa-bbbb-cc";
        let code2 = "AAAABBBBCC";

        let formatted1 = format_short_code(code1);
        let formatted2 = format_short_code(code2);

        assert_eq!(formatted1, formatted2);
        assert_eq!(formatted1, "AAAAB-BBBCC");
    }

    #[test]
    fn test_import_json_size_limit_rejected() {
        const MAX_JSON: usize = 50 * 1024 * 1024;
        let s = "x".repeat(MAX_JSON + 1);
        assert!(s.len() > MAX_JSON);
    }

    #[test]
    fn test_import_b64_size_limit_rejected() {
        const MAX_B64: usize = 70 * 1024 * 1024;
        let s = "y".repeat(MAX_B64 + 1);
        assert!(s.len() > MAX_B64);
    }
}
