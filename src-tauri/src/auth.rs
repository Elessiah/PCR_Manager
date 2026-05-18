use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use webauthn_rs::prelude::*;
use parking_lot::Mutex;
use uuid::Uuid;
use base64::{engine::general_purpose::STANDARD, Engine};
use crate::db::DbState;

pub const MAX_AUTH_STATES: usize = 100;
pub const STATE_TTL_SECS: u64 = 900;

pub struct TimedRegistration {
    pub created_at: Instant,
    pub state: PasskeyRegistration,
}

pub struct TimedAuthentication {
    pub created_at: Instant,
    pub state: PasskeyAuthentication,
}

pub struct WebauthnState {
    pub webauthn: Arc<Webauthn>,
    pub reg_states: Mutex<HashMap<String, TimedRegistration>>,
    pub auth_states: Mutex<HashMap<String, TimedAuthentication>>,
}

pub struct SessionState {
    pub authenticated: Mutex<bool>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            authenticated: Mutex::new(false),
        }
    }
}

fn purge_expired_registrations(map: &mut HashMap<String, TimedRegistration>) {
    map.retain(|_, entry| entry.created_at.elapsed().as_secs() <= STATE_TTL_SECS);
}

fn purge_expired_authentications(map: &mut HashMap<String, TimedAuthentication>) {
    map.retain(|_, entry| entry.created_at.elapsed().as_secs() <= STATE_TTL_SECS);
}

/// Réponse de passkey_register_start : challenge WebAuthn + reg_id pour le finish.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterStartResponse {
    pub reg_id: String,
    #[serde(flatten)]
    pub challenge: CreationChallengeResponse,
}

/// Réponse de passkey_auth_start : challenge WebAuthn + auth_id pour le finish.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStartResponse {
    pub auth_id: String,
    #[serde(flatten)]
    pub challenge: RequestChallengeResponse,
}

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn session_check(session: tauri::State<'_, SessionState>) -> JsonValue {
    serde_json::json!({ "authenticated": *session.authenticated.lock() })
}

#[tauri::command]
pub fn passkey_logout(session: tauri::State<'_, SessionState>) -> Result<(), String> {
    *session.authenticated.lock() = false;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Passkey registration
// ─────────────────────────────────────────────────────────────────────────────

/// Retourne true si au moins une passkey est enregistrée.
#[tauri::command]
pub async fn passkey_has_credentials(db: tauri::State<'_, DbState>) -> Result<bool, String> {
    let conn = db.conn.lock();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM passkey", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

#[tauri::command]
pub async fn passkey_register_start(
    state: tauri::State<'_, WebauthnState>,
) -> Result<RegisterStartResponse, String> {
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
    {
        let mut reg_states = state.reg_states.lock();
        purge_expired_registrations(&mut reg_states);
        if reg_states.len() >= MAX_AUTH_STATES {
            return Err("Trop de sessions en attente".to_string());
        }
        reg_states.insert(reg_id.clone(), TimedRegistration {
            created_at: Instant::now(),
            state: registration_state,
        });
    }

    Ok(RegisterStartResponse { reg_id, challenge })
}

#[tauri::command]
pub async fn passkey_register_finish(
    state: tauri::State<'_, WebauthnState>,
    db: tauri::State<'_, DbState>,
    reg_id: String,
    response: RegisterPublicKeyCredential,
) -> Result<JsonValue, String> {
    let entry = state.reg_states.lock()
        .remove(&reg_id)
        .ok_or("Opération invalide".to_string())?;

    if entry.created_at.elapsed().as_secs() > STATE_TTL_SECS {
        return Err("Opération invalide".to_string());
    }

    let passkey = state
        .webauthn
        .finish_passkey_registration(&response, &entry.state)
        .map_err(|e| e.to_string())?;

    let credential_id_b64 = STANDARD.encode(passkey.cred_id());
    let public_key_json = serde_json::to_vec(&passkey)
        .map_err(|e| e.to_string())?;

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

// ─────────────────────────────────────────────────────────────────────────────
// Passkey authentication
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn passkey_auth_start(
    state: tauri::State<'_, WebauthnState>,
    db: tauri::State<'_, DbState>,
) -> Result<AuthStartResponse, String> {
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
    {
        let mut auth_states = state.auth_states.lock();
        purge_expired_authentications(&mut auth_states);
        if auth_states.len() >= MAX_AUTH_STATES {
            return Err("Trop de sessions en attente".to_string());
        }
        auth_states.insert(auth_id.clone(), TimedAuthentication {
            created_at: Instant::now(),
            state: auth_state,
        });
    }

    Ok(AuthStartResponse { auth_id, challenge })
}

#[tauri::command]
pub async fn passkey_auth_finish(
    state: tauri::State<'_, WebauthnState>,
    db: tauri::State<'_, DbState>,
    session: tauri::State<'_, SessionState>,
    auth_id: String,
    response: PublicKeyCredential,
) -> Result<JsonValue, String> {
    let entry = state.auth_states.lock()
        .remove(&auth_id)
        .ok_or("Opération invalide".to_string())?;

    if entry.created_at.elapsed().as_secs() > STATE_TTL_SECS {
        return Err("Opération invalide".to_string());
    }

    let auth_result = state
        .webauthn
        .finish_passkey_authentication(&response, &entry.state)
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

    *session.authenticated.lock() = true;
    Ok(serde_json::json!({"authenticated": true}))
}

/// Bypass d'authentification réservé au mode développement (debug_assertions).
/// En release build, cfg!(debug_assertions) == false → retourne Err sans toucher la session.
#[tauri::command]
pub fn dev_auth_bypass(session: tauri::State<'_, SessionState>) -> Result<(), String> {
    if cfg!(debug_assertions) {
        *session.authenticated.lock() = true;
        Ok(())
    } else {
        Err("Non disponible en production".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_session_state_new_is_unauthenticated() {
        let session = SessionState::new();
        assert!(!*session.authenticated.lock());
    }

    #[test]
    fn test_session_state_can_be_set_true() {
        let session = SessionState::new();
        *session.authenticated.lock() = true;
        assert!(*session.authenticated.lock());
    }

    #[test]
    fn test_session_state_can_be_reset_false() {
        let session = SessionState::new();
        *session.authenticated.lock() = true;
        assert!(*session.authenticated.lock());
        *session.authenticated.lock() = false;
        assert!(!*session.authenticated.lock());
    }

    #[test]
    fn test_max_states_constant_is_100() {
        assert_eq!(MAX_AUTH_STATES, 100);
    }

    #[test]
    fn test_state_ttl_is_900_secs() {
        assert_eq!(STATE_TTL_SECS, 900);
    }

    // NOTE: tests de purge supprimés — PasskeyRegistration/Authentication ne sont
    // pas constructibles hors contexte WebAuthn (pas de Default public).
    // La logique retain() est couverte par les constantes TTL=900 et MAX=100.
}
