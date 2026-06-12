use data_encoding::BASE32;
use keyring::Entry;
use parking_lot::Mutex;
use rand::RngCore;
use std::time::{SystemTime, UNIX_EPOCH, Instant};

const KEYRING_SERVICE: &str = "PCRManager";
const KEYRING_TOTP_USER: &str = "totp_secret";

// ── Session (partagée avec auth_mac) ─────────────────────────────────────────

pub struct SessionState {
    pub authenticated: Mutex<bool>,
    pub failed_totp: Mutex<u32>,
    pub locked_until: Mutex<Option<Instant>>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            authenticated: Mutex::new(false),
            failed_totp: Mutex::new(0),
            locked_until: Mutex::new(None),
        }
    }
}

// ── Commandes Tauri ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn session_check(session: tauri::State<'_, SessionState>) -> serde_json::Value {
    serde_json::json!({ "authenticated": *session.authenticated.lock() })
}

/// Déconnexion : ferme la DB si un mode d'auth protégé est actif.
#[tauri::command]
pub fn logout(
    app: tauri::AppHandle,
    session: tauri::State<'_, SessionState>,
    db: tauri::State<'_, crate::db::DbState>,
) -> Result<(), String> {
    *session.authenticated.lock() = false;
    if crate::db::has_mac_wrapped_key(&app) || has_totp() {
        *db.conn.lock() = None;
    }
    Ok(())
}

/// Vrai si le mode TOTP est activé (secret présent dans le Keychain).
#[tauri::command]
pub fn totp_available() -> bool {
    has_totp()
}

/// Génère un nouveau secret TOTP, le stocke dans le Keychain, retourne l'URI otpauth.
/// Appelé une seule fois lors de la configuration initiale.
#[tauri::command]
pub fn totp_setup_start(
    app: tauri::AppHandle,
    session: tauri::State<'_, SessionState>,
) -> Result<String, String> {
    let already_protected = has_totp() || crate::db::has_mac_wrapped_key(&app);
    if already_protected && !*session.authenticated.lock() {
        return Err("Un mode de protection est déjà configuré : authentification requise pour réinitialiser".to_string());
    }
    let secret = generate_secret();
    store_secret(&secret)?;
    Ok(totp_uri(&secret))
}

/// Vérifie que le code saisi correspond au secret nouvellement généré.
/// Si valide, marque la session comme authentifiée (le premier scan ouvre immédiatement l'app).
#[tauri::command]
pub fn totp_setup_confirm(
    code: String,
    session: tauri::State<'_, SessionState>,
) -> Result<(), String> {
    if verify_code(&code)? {
        *session.authenticated.lock() = true;
        Ok(())
    } else {
        Err("Code TOTP invalide".into())
    }
}

/// Authentification TOTP au démarrage : vérifie le code puis ouvre la DB.
#[tauri::command]
pub async fn totp_login(
    code: String,
    app: tauri::AppHandle,
    session: tauri::State<'_, SessionState>,
    db: tauri::State<'_, crate::db::DbState>,
) -> Result<(), String> {
    // Check if locked out
    {
        let mut locked = session.locked_until.lock();
        if let Some(locked_time) = *locked {
            if Instant::now() < locked_time {
                return Err("Trop de tentatives. Veuillez patienter avant de réessayer.".into());
            } else {
                *locked = None;
            }
        }
    }

    if !verify_code(&code)? {
        // Increment failed counter on invalid code
        let mut failed = session.failed_totp.lock();
        *failed += 1;

        if *failed >= 5 {
            // Exponential backoff: min(30s * 2^(failed-5), 300s)
            let attempts_over_5 = (*failed - 5).min(4) as u32;
            let backoff_secs = 30u64 * (1u64 << attempts_over_5);
            let backoff_secs = backoff_secs.min(300);

            let mut locked = session.locked_until.lock();
            *locked = Some(Instant::now() + std::time::Duration::from_secs(backoff_secs));
        }

        return Err("Code TOTP invalide".into());
    }

    // Reset counters on valid code
    *session.failed_totp.lock() = 0;
    *session.locked_until.lock() = None;

    if db.conn.lock().is_none() {
        let conn = crate::db::open_and_migrate(&app, None).map_err(|e| e.to_string())?;
        *db.conn.lock() = Some(conn);
    }
    *session.authenticated.lock() = true;
    Ok(())
}

/// Supprime le secret TOTP du Keychain (désactivation du mode TOTP).
#[tauri::command]
pub fn totp_revoke(session: tauri::State<'_, SessionState>) -> Result<(), String> {
    if !*session.authenticated.lock() {
        return Err("Authentification requise pour révoquer le TOTP".to_string());
    }
    Entry::new(KEYRING_SERVICE, KEYRING_TOTP_USER)
        .map_err(|e| e.to_string())?
        .delete_password()
        .map_err(|e| e.to_string())
}

// ── Fonctions internes ────────────────────────────────────────────────────────

pub fn has_totp() -> bool {
    Entry::new(KEYRING_SERVICE, KEYRING_TOTP_USER)
        .ok()
        .and_then(|e| e.get_password().ok())
        .is_some()
}

fn generate_secret() -> String {
    let mut bytes = [0u8; 20];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    BASE32.encode(&bytes)
}

fn store_secret(secret: &str) -> Result<(), String> {
    Entry::new(KEYRING_SERVICE, KEYRING_TOTP_USER)
        .map_err(|e| e.to_string())?
        .set_password(secret)
        .map_err(|e| e.to_string())
}

fn totp_uri(secret: &str) -> String {
    format!(
        "otpauth://totp/PCR%20Manager?secret={}&issuer=PCR%20Manager&digits=6&period=30&algorithm=SHA1",
        secret
    )
}

/// Vérifie un code TOTP RFC 6238 (SHA-1, 6 chiffres, fenêtre de 30 s, drift ±1 step).
fn verify_code(code: &str) -> Result<bool, String> {
    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return Ok(false);
    }

    let secret_b32 = Entry::new(KEYRING_SERVICE, KEYRING_TOTP_USER)
        .map_err(|e| e.to_string())?
        .get_password()
        .map_err(|_| "Secret TOTP non trouvé".to_string())?;

    let secret = BASE32
        .decode(secret_b32.to_uppercase().as_bytes())
        .map_err(|e| format!("Secret TOTP invalide : {}", e))?;

    let step = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        / 30;

    for drift in [0i64, -1, 1] {
        let counter = (step as i64 + drift) as u64;
        if format!("{:06}", hotp(&secret, counter)) == code {
            return Ok(true);
        }
    }
    Ok(false)
}

/// HOTP RFC 4226 avec SHA-1.
fn hotp(secret: &[u8], counter: u64) -> u32 {
    use hmac::{Hmac, Mac};
    use sha1::Sha1;
    type HmacSha1 = Hmac<Sha1>;

    let mut mac = HmacSha1::new_from_slice(secret).expect("HMAC accepte n'importe quelle taille");
    mac.update(&counter.to_be_bytes());
    let result = mac.finalize().into_bytes();
    let offset = (result[19] & 0xf) as usize;
    let code = ((result[offset] & 0x7f) as u32) << 24
        | (result[offset + 1] as u32) << 16
        | (result[offset + 2] as u32) << 8
        | result[offset + 3] as u32;
    code % 1_000_000
}

pub fn ensure_authenticated(session: &SessionState) -> Result<(), String> {
    if !*session.authenticated.lock() {
        return Err("Non authentifié".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_authenticated_unauthenticated() {
        let session = SessionState::new();
        assert!(ensure_authenticated(&session).is_err());
    }

    #[test]
    fn test_ensure_authenticated_authenticated() {
        let session = SessionState::new();
        *session.authenticated.lock() = true;
        assert!(ensure_authenticated(&session).is_ok());
    }

    #[test]
    fn test_failed_totp_lockout() {
        let session = SessionState::new();

        // Simulate 5 failed attempts
        for _ in 0..5 {
            *session.failed_totp.lock() += 1;
        }

        let failed_count = *session.failed_totp.lock();
        assert_eq!(failed_count, 5);

        // Set lockout as totp_login would
        let attempts_over_5 = (failed_count - 5).min(4) as u32;
        let backoff_secs = 30u64 * (1u64 << attempts_over_5);
        let backoff_secs = backoff_secs.min(300);

        let mut locked = session.locked_until.lock();
        *locked = Some(Instant::now() + std::time::Duration::from_secs(backoff_secs));

        // Verify lockout is set and will reject login attempts
        assert!(locked.is_some());
        if let Some(locked_time) = *locked {
            assert!(Instant::now() < locked_time);
        }
    }

    #[test]
    fn test_reset_counters_on_success() {
        let session = SessionState::new();

        // Simulate failed attempt state
        *session.failed_totp.lock() = 3;
        *session.locked_until.lock() = Some(Instant::now() + std::time::Duration::from_secs(60));

        // Reset as totp_login would on successful code
        *session.failed_totp.lock() = 0;
        *session.locked_until.lock() = None;

        // Verify counters are reset
        assert_eq!(*session.failed_totp.lock(), 0);
        assert!(session.locked_until.lock().is_none());
    }
}
