use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use webauthn_rs::prelude::*;
use parking_lot::Mutex;
use uuid::Uuid;
use base64::{engine::general_purpose::STANDARD, Engine};
use crate::db::DbState;

pub struct WebauthnState {
    pub webauthn: Arc<Webauthn>,
    pub reg_states: Mutex<HashMap<String, PasskeyRegistration>>,
    pub auth_states: Mutex<HashMap<String, PasskeyAuthentication>>,
}

#[tauri::command]
pub async fn passkey_register_start(
    state: tauri::State<'_, WebauthnState>,
) -> Result<CreationChallengeResponse, String> {
    let user_id = Uuid::new_v4();
    let user_name = format!("user_{}", Uuid::new_v4());
    let user_display_name = "PCR Manager User";

    let (challenge, registration_state) = state
        .webauthn
        .start_passkey_registration(
            user_id,
            &user_name,
            user_display_name,
            None,
        )
        .map_err(|e| e.to_string())?;

    let reg_id = Uuid::new_v4().to_string();
    state.reg_states.lock().insert(reg_id, registration_state);

    Ok(challenge)
}

#[tauri::command]
pub async fn passkey_register_finish(
    state: tauri::State<'_, WebauthnState>,
    db: tauri::State<'_, DbState>,
    reg_id: String,
    response: RegisterPublicKeyCredential,
) -> Result<JsonValue, String> {
    let reg_state = state.reg_states.lock()
        .remove(&reg_id)
        .ok_or("Registration state not found")?;

    let passkey = state
        .webauthn
        .finish_passkey_registration(&response, &reg_state)
        .map_err(|e| e.to_string())?;

    let credential_id_b64 = STANDARD.encode(passkey.cred_id());
    let public_key_json = serde_json::to_vec(&passkey)
        .map_err(|e| e.to_string())?;

    // webauthn-rs 0.5: la Passkey ne stocke pas de counter explicite côté serveur
    // (l'API gere les replay-attacks differemment). On initialise a 0.
    let initial_sign_count: i32 = 0;

    let conn = db.conn.lock();
    conn.execute(
        "INSERT INTO passkey (credential_id, public_key, sign_count, label, created_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        rusqlite::params![
            &credential_id_b64,
            &public_key_json,
            initial_sign_count,
            "Unnamed Passkey"
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"registered": true}))
}

#[tauri::command]
pub async fn passkey_auth_start(
    state: tauri::State<'_, WebauthnState>,
    db: tauri::State<'_, DbState>,
) -> Result<RequestChallengeResponse, String> {
    let conn = db.conn.lock();
    let mut stmt = conn
        .prepare("SELECT public_key FROM passkey")
        .map_err(|e| e.to_string())?;

    let passkeys: Vec<Passkey> = stmt
        .query_map([], |row| {
            let pk_bytes: Vec<u8> = row.get(0)?;
            let pk: Passkey = serde_json::from_slice(&pk_bytes)
                .map_err(|_| rusqlite::Error::InvalidQuery)?;
            Ok(pk)
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let (challenge, auth_state) = state
        .webauthn
        .start_passkey_authentication(&passkeys)
        .map_err(|e| e.to_string())?;

    let auth_id = Uuid::new_v4().to_string();
    state.auth_states.lock().insert(auth_id, auth_state);

    Ok(challenge)
}

#[tauri::command]
pub async fn passkey_auth_finish(
    state: tauri::State<'_, WebauthnState>,
    db: tauri::State<'_, DbState>,
    auth_id: String,
    response: PublicKeyCredential,
) -> Result<JsonValue, String> {
    let auth_state = state.auth_states.lock()
        .remove(&auth_id)
        .ok_or("Authentication state not found")?;

    let auth_result = state
        .webauthn
        .finish_passkey_authentication(&response, &auth_state)
        .map_err(|e| e.to_string())?;

    let credential_id_b64 = STANDARD.encode(auth_result.cred_id());

    let conn = db.conn.lock();
    conn.execute(
        "UPDATE passkey SET sign_count = ?1, last_used_at = datetime('now')
         WHERE credential_id = ?2",
        rusqlite::params![
            auth_result.counter() as i32,
            &credential_id_b64
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"authenticated": true}))
}
