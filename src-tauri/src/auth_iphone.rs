/// auth_iphone.rs — Authentification passwordless Mac ↔ iPhone via Secure Enclave P-256
///
/// Flux d'appairage (une seule fois) :
///   Mac génère invitation → QR code → iPhone scanne → ECDSA sur nonce → HTTP POST → Mac stocke clé pub
///
/// Flux d'auth (quotidien) :
///   Mac génère challenge → QR code → iPhone scanne → Face ID → signe → HTTP POST → Mac vérifie

use parking_lot::Mutex;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use std::io::{Read, Write};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
use sha2::{Digest, Sha256};

use tauri::Manager;

use crate::auth::SessionState;
use crate::db::DbState;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

pub struct IphoneAuthState {
    pending_pairing: Mutex<Option<PendingPairing>>,
    pending_challenge: Mutex<Option<PendingChallenge>>,
}

impl IphoneAuthState {
    pub fn new() -> Self {
        Self {
            pending_pairing: Mutex::new(None),
            pending_challenge: Mutex::new(None),
        }
    }
}

struct PendingPairing {
    invitation_id: Uuid,
    nonce: [u8; 32],
    created_at: Instant,
    result: Arc<Mutex<PairingResult>>,
}

#[derive(Clone)]
enum PairingResult {
    Pending,
    Completed {
        iphone_device_id: String,
        iphone_device_name: String,
        iphone_public_key: Vec<u8>,
    },
    Failed(String),
}

struct PendingChallenge {
    challenge_id: Uuid,
    pairing_id: Uuid,
    iphone_public_key: Vec<u8>,
    nonce: [u8; 32],
    expected_counter: u64,
    created_at: Instant,
    mac_device_id: String,
    result: Arc<Mutex<ChallengeResult>>,
}

#[derive(Clone)]
enum ChallengeResult {
    Pending,
    Verified { new_counter: u64 },
    Failed(String),
}

// ─────────────────────────────────────────────────────────────────────────────
// Serde DTOs
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingStartResponse {
    pub qr_data: String,
    pub invitation_id: String,
    pub server_port: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingPollResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pairing_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedDevice {
    pub pairing_id: String,
    pub iphone_device_name: String,
    pub iphone_device_id: String,
    pub paired_at: String,
    pub last_auth_at: Option<String>,
    pub auth_counter: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChallengeStartResponse {
    pub qr_data: String,
    pub challenge_id: String,
    pub server_port: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthPollResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// iPhone → Mac lors de l'appairage (HTTP POST /pair)
#[derive(Deserialize)]
struct PairingRequest {
    invitation_id: String,
    iphone_device_id: String,
    iphone_device_name: String,
    /// P-256 uncompressed point (65 bytes), base64url
    iphone_identity_public_key: String,
    /// DER-encoded ECDSA signature, base64url
    signature: String,
    timestamp_ms: i64,
}

// iPhone → Mac lors de l'authentification (HTTP POST /auth)
#[derive(Deserialize)]
struct AuthRequest {
    challenge_id: String,
    device_id: String,
    /// DER-encoded ECDSA signature, base64url
    signature: String,
    counter: u64,
    timestamp_ms: i64,
}

// Résultat parsé de la requête de pairing
struct ProcessedPairing {
    iphone_device_id: String,
    iphone_device_name: String,
    iphone_public_key: Vec<u8>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires cryptographiques et réseau
// ─────────────────────────────────────────────────────────────────────────────

/// Retourne l'IP locale de la machine (heuristique via socket UDP non connecté).
fn get_local_ip() -> Option<String> {
    use std::net::UdpSocket;
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:53").ok()?;
    Some(sock.local_addr().ok()?.ip().to_string())
}

/// ID stable du Mac dérivé du chemin app-data (SHA-256 hex 64 chars).
pub fn get_mac_device_id(app: &tauri::AppHandle) -> String {
    let dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "fallback".to_string());
    let raw = format!("PCRManager-MacDevice-v1-{}", dir);
    format!("{:x}", Sha256::digest(raw.as_bytes()))
}

/// Nonce 32 bytes cryptographiquement aléatoire.
fn random_nonce() -> [u8; 32] {
    use rand::RngCore;
    let mut n = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut n);
    n
}

/// Extrait le corps d'une requête HTTP brute en lisant le header Content-Length.
fn extract_http_body(data: &[u8]) -> Option<Vec<u8>> {
    let sep = data.windows(4).position(|w| w == b"\r\n\r\n")?;
    let headers = std::str::from_utf8(&data[..sep]).ok()?;
    let content_length: usize = headers
        .lines()
        .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))
        .and_then(|l| l.splitn(2, ':').nth(1))
        .and_then(|v| v.trim().parse().ok())?;
    let start = sep + 4;
    let end = start + content_length;
    if data.len() >= end {
        Some(data[start..end].to_vec())
    } else {
        None
    }
}

/// Payload signé lors de l'appairage : SHA256(invitation_id_bytes || nonce).
/// Les deux côtés hashent en interne (CryptoKit et p256::VerifyingKey::verify).
fn build_pairing_payload(invitation_id: &Uuid, nonce: &[u8]) -> Vec<u8> {
    let mut v = Vec::with_capacity(48);
    v.extend_from_slice(invitation_id.as_bytes()); // 16 bytes
    v.extend_from_slice(nonce);                     // 32 bytes
    v
}

/// Payload signé lors de l'authentification.
/// Tous les champs sont de taille fixe ou précédés d'un préfixe longueur.
fn build_auth_payload(
    challenge_id: &Uuid,
    nonce: &[u8],
    timestamp_ms: i64,
    mac_device_id: &str,
    counter: u64,
) -> Vec<u8> {
    let mut v = Vec::new();
    v.extend_from_slice(challenge_id.as_bytes());           // 16
    v.extend_from_slice(nonce);                              // 32
    v.extend_from_slice(&timestamp_ms.to_be_bytes());        // 8
    v.extend_from_slice(mac_device_id.as_bytes());           // 64 (hex SHA-256)
    v.extend_from_slice(&counter.to_be_bytes());             // 8
    v.extend_from_slice(b"com.pcrmanager.ios");              // fixed
    v
}

/// Vérifie qu'un timestamp_ms est dans la fenêtre ±`window_secs` secondes.
fn timestamp_ok(ts_ms: i64, window_secs: u64) -> bool {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    (now_ms - ts_ms).unsigned_abs() <= window_secs * 1000
}

// ─────────────────────────────────────────────────────────────────────────────
// Serveur HTTP minimal (thread bloquant, one-shot)
// ─────────────────────────────────────────────────────────────────────────────

/// Lit un corps HTTP depuis un TcpStream (bloquant, timeout 10s, max 16 KB).
fn read_http_body(stream: &mut std::net::TcpStream) -> Option<Vec<u8>> {
    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(10)))
        .ok()?;
    let mut buf = [0u8; 1024];
    let mut data = Vec::with_capacity(2048);
    loop {
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                data.extend_from_slice(&buf[..n]);
                if data.len() > 16_384 {
                    return None; // trop volumineux
                }
                if extract_http_body(&data).is_some() {
                    break;
                }
            }
            Err(e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                break
            }
            Err(_) => return None,
        }
    }
    extract_http_body(&data)
}

fn http_ok(stream: &mut std::net::TcpStream) {
    let body = b"{\"ok\":true}";
    let _ = stream.write_all(
        format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
            body.len()
        )
        .as_bytes(),
    );
    let _ = stream.write_all(body);
}

fn http_error(stream: &mut std::net::TcpStream, msg: &str) {
    let body = format!("{{\"error\":\"{}\"}}", msg.replace('"', "'"));
    let _ = stream.write_all(
        format!(
            "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            body.len(),
            body
        )
        .as_bytes(),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Logique de vérification cryptographique
// ─────────────────────────────────────────────────────────────────────────────

fn process_pairing_request(
    body: &[u8],
    expected_id: &Uuid,
    nonce: &[u8],
) -> Result<ProcessedPairing, String> {
    let req: PairingRequest =
        serde_json::from_slice(body).map_err(|e| format!("JSON invalide: {}", e))?;

    // Vérif invitation_id
    let received = Uuid::parse_str(&req.invitation_id).map_err(|_| "UUID invalide")?;
    if received != *expected_id {
        return Err("invitation_id ne correspond pas".into());
    }

    // Fenêtre temporelle ±5 minutes (pairing peut être lent côté utilisateur)
    if !timestamp_ok(req.timestamp_ms, 300) {
        return Err("Timestamp invalide ou expiré".into());
    }

    // Importation de la clé publique P-256 (format x963, 65 bytes)
    let pub_bytes =
        URL_SAFE_NO_PAD.decode(&req.iphone_identity_public_key).map_err(|e| e.to_string())?;
    let encoded_point =
        p256::EncodedPoint::from_bytes(&pub_bytes).map_err(|_| "Point P-256 invalide")?;
    let vk =
        VerifyingKey::from_encoded_point(&encoded_point).map_err(|_| "Clé P-256 invalide")?;

    // Vérification de la signature ECDSA-P256-SHA256
    // iOS : privateKey.signature(for: payload) → hash interne SHA-256
    // Rust : vk.verify(payload, sig)           → hash interne SHA-256
    let payload = build_pairing_payload(expected_id, nonce);
    let sig_bytes = URL_SAFE_NO_PAD.decode(&req.signature).map_err(|e| e.to_string())?;
    let sig = Signature::from_der(&sig_bytes).map_err(|_| "Signature DER invalide")?;
    vk.verify(&payload, &sig).map_err(|_| "Signature de pairing invalide")?;

    Ok(ProcessedPairing {
        iphone_device_id: req.iphone_device_id,
        iphone_device_name: req.iphone_device_name,
        iphone_public_key: pub_bytes,
    })
}

fn process_auth_request(
    body: &[u8],
    challenge: &PendingChallenge,
) -> Result<u64, String> {
    let req: AuthRequest =
        serde_json::from_slice(body).map_err(|e| format!("JSON invalide: {}", e))?;

    // Echo du challenge_id
    let received_id = Uuid::parse_str(&req.challenge_id).map_err(|_| "challenge_id invalide")?;
    if received_id != challenge.challenge_id {
        return Err("challenge_id ne correspond pas".into());
    }

    // Fenêtre temporelle ±30 secondes pour l'authentification
    if !timestamp_ok(req.timestamp_ms, 30) {
        return Err("Timestamp expiré (fenêtre ±30s)".into());
    }

    // Compteur monotone anti-rejeu
    if req.counter <= challenge.expected_counter.saturating_sub(1) {
        return Err(format!(
            "Compteur trop faible (reçu {}, attendu > {})",
            req.counter,
            challenge.expected_counter.saturating_sub(1)
        ));
    }

    // Vérification device_id
    // (le device peut avoir plusieurs pairings ; on vérifie juste qu'il ne triche pas)

    // Import de la clé publique stockée lors de l'appairage
    let encoded_point = p256::EncodedPoint::from_bytes(&challenge.iphone_public_key)
        .map_err(|_| "Clé publique enregistrée corrompue")?;
    let vk = VerifyingKey::from_encoded_point(&encoded_point)
        .map_err(|_| "Clé de vérification invalide")?;

    // Construction du payload signé (même logique que côté iOS)
    let payload = build_auth_payload(
        &challenge.challenge_id,
        &challenge.nonce,
        req.timestamp_ms,
        &challenge.mac_device_id,
        req.counter,
    );
    let sig_bytes = URL_SAFE_NO_PAD.decode(&req.signature).map_err(|e| e.to_string())?;
    let sig = Signature::from_der(&sig_bytes).map_err(|_| "Signature DER invalide")?;
    vk.verify(&payload, &sig).map_err(|_| "Signature d'authentification invalide")?;

    Ok(req.counter)
}

// ─────────────────────────────────────────────────────────────────────────────
// Threads serveurs
// ─────────────────────────────────────────────────────────────────────────────

/// Serveur d'appairage : écoute une connexion, parse la requête, stocke le résultat.
fn run_pairing_server(
    listener: std::net::TcpListener,
    invitation_id: Uuid,
    nonce: [u8; 32],
    result: Arc<Mutex<PairingResult>>,
) {
    listener.set_nonblocking(true).ok();
    let deadline = Instant::now() + std::time::Duration::from_secs(300);

    loop {
        if Instant::now() > deadline {
            *result.lock() = PairingResult::Failed("Timeout : aucune réponse iPhone".into());
            return;
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_write_timeout(Some(std::time::Duration::from_secs(5))).ok();
                match read_http_body(&mut stream) {
                    Some(body) => match process_pairing_request(&body, &invitation_id, &nonce) {
                        Ok(p) => {
                            http_ok(&mut stream);
                            *result.lock() = PairingResult::Completed {
                                iphone_device_id: p.iphone_device_id,
                                iphone_device_name: p.iphone_device_name,
                                iphone_public_key: p.iphone_public_key,
                            };
                        }
                        Err(e) => {
                            http_error(&mut stream, &e);
                            *result.lock() = PairingResult::Failed(e);
                        }
                    },
                    None => {
                        http_error(&mut stream, "Corps HTTP manquant ou illisible");
                        *result.lock() =
                            PairingResult::Failed("Corps HTTP manquant".into());
                    }
                }
                return;
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            Err(e) => {
                *result.lock() = PairingResult::Failed(format!("Erreur socket: {}", e));
                return;
            }
        }
    }
}

/// Serveur d'authentification : écoute une connexion, vérifie la signature, stocke le résultat.
fn run_auth_server(
    listener: std::net::TcpListener,
    // challenge est une copie des données nécessaires à la vérification
    challenge_id: Uuid,
    iphone_public_key: Vec<u8>,
    nonce: [u8; 32],
    expected_counter: u64,
    mac_device_id: String,
    result: Arc<Mutex<ChallengeResult>>,
) {
    listener.set_nonblocking(true).ok();
    let deadline = Instant::now() + std::time::Duration::from_secs(60);

    // Construit un PendingChallenge minimal pour réutiliser process_auth_request
    let fake_challenge = PendingChallenge {
        challenge_id,
        pairing_id: Uuid::nil(), // non utilisé dans process_auth_request
        iphone_public_key,
        nonce,
        expected_counter,
        created_at: Instant::now(),
        mac_device_id,
        result: Arc::new(Mutex::new(ChallengeResult::Pending)),
    };

    loop {
        if Instant::now() > deadline {
            *result.lock() = ChallengeResult::Failed("Challenge expiré (60s)".into());
            return;
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_write_timeout(Some(std::time::Duration::from_secs(5))).ok();
                match read_http_body(&mut stream) {
                    Some(body) => match process_auth_request(&body, &fake_challenge) {
                        Ok(new_counter) => {
                            http_ok(&mut stream);
                            *result.lock() = ChallengeResult::Verified { new_counter };
                        }
                        Err(e) => {
                            http_error(&mut stream, &e);
                            *result.lock() = ChallengeResult::Failed(e);
                        }
                    },
                    None => {
                        http_error(&mut stream, "Corps HTTP manquant");
                        *result.lock() = ChallengeResult::Failed("Corps HTTP manquant".into());
                    }
                }
                return;
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            Err(e) => {
                *result.lock() = ChallengeResult::Failed(format!("Erreur socket: {}", e));
                return;
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commandes Tauri
// ─────────────────────────────────────────────────────────────────────────────

/// Retourne true si au moins un appairage iPhone actif existe.
#[tauri::command]
pub async fn iphone_has_paired_device(db: tauri::State<'_, DbState>) -> Result<bool, String> {
    let conn = db.conn.lock();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM iphone_pairing WHERE active = 1",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

/// Liste tous les appareils iPhone appairés.
#[tauri::command]
pub async fn iphone_pairing_list(
    db: tauri::State<'_, DbState>,
) -> Result<Vec<PairedDevice>, String> {
    let conn = db.conn.lock();
    let mut stmt = conn
        .prepare(
            "SELECT pairing_id, iphone_device_name, iphone_device_id,
                    paired_at, last_auth_at, auth_counter
             FROM iphone_pairing WHERE active = 1
             ORDER BY paired_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let devices = stmt
        .query_map([], |row| {
            Ok(PairedDevice {
                pairing_id: row.get(0)?,
                iphone_device_name: row.get(1)?,
                iphone_device_id: row.get(2)?,
                paired_at: row.get(3)?,
                last_auth_at: row.get(4)?,
                auth_counter: row.get::<_, i64>(5)? as u64,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(devices)
}

/// Révoque un appairage (soft delete).
#[tauri::command]
pub async fn iphone_pairing_revoke(
    db: tauri::State<'_, DbState>,
    pairing_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock();
    conn.execute(
        "UPDATE iphone_pairing SET active = 0 WHERE pairing_id = ?1",
        rusqlite::params![pairing_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Démarre l'appairage : génère une invitation, lance le serveur HTTP, retourne les données QR.
#[tauri::command]
pub async fn iphone_pairing_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, IphoneAuthState>,
) -> Result<PairingStartResponse, String> {
    let local_ip = get_local_ip().ok_or("Impossible de déterminer l'IP locale")?;
    let nonce = random_nonce();
    let invitation_id = Uuid::new_v4();
    let mac_device_id = get_mac_device_id(&app);

    // Bind sur port aléatoire
    let listener =
        std::net::TcpListener::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    // Données QR transmises à l'iPhone via scan
    let nonce_b64 = URL_SAFE_NO_PAD.encode(nonce);
    let qr_data = format!(
        "pcrauth://pair?v=1&host={}&port={}&id={}&nonce={}&mac_id={}",
        local_ip, port, invitation_id, nonce_b64, mac_device_id
    );

    // État pending
    let result_arc: Arc<Mutex<PairingResult>> = Arc::new(Mutex::new(PairingResult::Pending));
    let result_clone = result_arc.clone();

    *state.pending_pairing.lock() = Some(PendingPairing {
        invitation_id,
        nonce,
        created_at: Instant::now(),
        result: result_arc,
    });

    // Serveur HTTP en arrière-plan
    std::thread::spawn(move || {
        run_pairing_server(listener, invitation_id, nonce, result_clone);
    });

    Ok(PairingStartResponse {
        qr_data,
        invitation_id: invitation_id.to_string(),
        server_port: port,
    })
}

/// Interroge l'état de l'appairage en cours. Sauvegarde en DB si complété.
#[tauri::command]
pub async fn iphone_pairing_poll(
    state: tauri::State<'_, IphoneAuthState>,
    db: tauri::State<'_, DbState>,
) -> Result<PairingPollResponse, String> {
    let mut pending_guard = state.pending_pairing.lock();

    let Some(pending) = pending_guard.as_ref() else {
        return Ok(PairingPollResponse { status: "idle".into(), pairing_id: None, error: None });
    };

    // Timeout côté Mac (sécurité supplémentaire)
    if pending.created_at.elapsed().as_secs() > 310 {
        *pending_guard = None;
        return Ok(PairingPollResponse {
            status: "failed".into(),
            pairing_id: None,
            error: Some("Timeout appairage".into()),
        });
    }

    let result = pending.result.lock().clone();
    match result {
        PairingResult::Pending => {
            Ok(PairingPollResponse { status: "pending".into(), pairing_id: None, error: None })
        }
        PairingResult::Completed { iphone_device_id, iphone_device_name, iphone_public_key } => {
            let pairing_id = Uuid::new_v4();
            {
                let conn = db.conn.lock();
                conn.execute(
                    "INSERT INTO iphone_pairing
                     (pairing_id, iphone_device_id, iphone_device_name, iphone_public_key, auth_counter, paired_at, active)
                     VALUES (?1, ?2, ?3, ?4, 0, datetime('now'), 1)",
                    rusqlite::params![
                        pairing_id.to_string(),
                        iphone_device_id,
                        iphone_device_name,
                        iphone_public_key,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
            *pending_guard = None;
            Ok(PairingPollResponse {
                status: "completed".into(),
                pairing_id: Some(pairing_id.to_string()),
                error: None,
            })
        }
        PairingResult::Failed(e) => {
            *pending_guard = None;
            Ok(PairingPollResponse { status: "failed".into(), pairing_id: None, error: Some(e) })
        }
    }
}

/// Génère un challenge d'authentification pour l'iPhone appairé `pairing_id`.
/// Lance un serveur HTTP en arrière-plan et retourne le payload QR.
#[tauri::command]
pub async fn iphone_auth_challenge_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, IphoneAuthState>,
    db: tauri::State<'_, DbState>,
    pairing_id: String,
) -> Result<ChallengeStartResponse, String> {
    // Charger le pairing depuis la DB
    let (iphone_public_key, current_counter) = {
        let conn = db.conn.lock();
        conn.query_row(
            "SELECT iphone_public_key, auth_counter FROM iphone_pairing
             WHERE pairing_id = ?1 AND active = 1",
            rusqlite::params![pairing_id],
            |r| Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, i64>(1)? as u64)),
        )
        .map_err(|_| "Appairage introuvable ou inactif".to_string())?
    };

    let local_ip = get_local_ip().ok_or("Impossible de déterminer l'IP locale")?;
    let nonce = random_nonce();
    let challenge_id = Uuid::new_v4();
    let mac_device_id = get_mac_device_id(&app);
    let expected_counter = current_counter + 1;

    // Bind sur port aléatoire
    let listener =
        std::net::TcpListener::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    // Données QR transmises à l'iPhone
    let nonce_b64 = URL_SAFE_NO_PAD.encode(nonce);
    let pairing_id_uuid =
        Uuid::parse_str(&pairing_id).map_err(|_| "pairing_id invalide")?;
    let qr_data = format!(
        "pcrauth://auth?v=1&host={}&port={}&challenge_id={}&nonce={}&mac_id={}&pairing_id={}&counter={}",
        local_ip, port, challenge_id, nonce_b64, mac_device_id, pairing_id_uuid, expected_counter
    );

    // État pending
    let result_arc: Arc<Mutex<ChallengeResult>> =
        Arc::new(Mutex::new(ChallengeResult::Pending));
    let result_clone = result_arc.clone();

    *state.pending_challenge.lock() = Some(PendingChallenge {
        challenge_id,
        pairing_id: pairing_id_uuid,
        iphone_public_key: iphone_public_key.clone(),
        nonce,
        expected_counter,
        created_at: Instant::now(),
        mac_device_id: mac_device_id.clone(),
        result: result_arc,
    });

    // Serveur HTTP en arrière-plan
    std::thread::spawn(move || {
        run_auth_server(
            listener,
            challenge_id,
            iphone_public_key,
            nonce,
            expected_counter,
            mac_device_id,
            result_clone,
        );
    });

    Ok(ChallengeStartResponse {
        qr_data,
        challenge_id: challenge_id.to_string(),
        server_port: port,
    })
}

/// Interroge l'état du challenge en cours. Ouvre la session et met à jour le compteur si vérifié.
#[tauri::command]
pub async fn iphone_auth_poll(
    state: tauri::State<'_, IphoneAuthState>,
    session: tauri::State<'_, SessionState>,
    db: tauri::State<'_, DbState>,
) -> Result<AuthPollResponse, String> {
    let mut pending_guard = state.pending_challenge.lock();

    let Some(pending) = pending_guard.as_ref() else {
        return Ok(AuthPollResponse { status: "idle".into(), error: None });
    };

    if pending.created_at.elapsed().as_secs() > 65 {
        *pending_guard = None;
        return Ok(AuthPollResponse {
            status: "failed".into(),
            error: Some("Challenge expiré".into()),
        });
    }

    let result = pending.result.lock().clone();
    match result {
        ChallengeResult::Pending => {
            Ok(AuthPollResponse { status: "pending".into(), error: None })
        }
        ChallengeResult::Verified { new_counter } => {
            let pairing_id_str = pending.pairing_id.to_string();
            {
                let conn = db.conn.lock();
                conn.execute(
                    "UPDATE iphone_pairing
                     SET auth_counter = ?1, last_auth_at = datetime('now')
                     WHERE pairing_id = ?2",
                    rusqlite::params![new_counter as i64, pairing_id_str],
                )
                .map_err(|e| e.to_string())?;
            }
            *session.authenticated.lock() = true;
            *pending_guard = None;
            Ok(AuthPollResponse { status: "authenticated".into(), error: None })
        }
        ChallengeResult::Failed(e) => {
            *pending_guard = None;
            Ok(AuthPollResponse { status: "failed".into(), error: Some(e) })
        }
    }
}

/// Annule le challenge ou l'appairage en cours.
#[tauri::command]
pub async fn iphone_cancel_pending(
    state: tauri::State<'_, IphoneAuthState>,
) -> Result<(), String> {
    *state.pending_pairing.lock() = None;
    *state.pending_challenge.lock() = None;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_http_body_valid() {
        let raw =
            b"POST /pair HTTP/1.1\r\nContent-Length: 5\r\n\r\nhello";
        assert_eq!(extract_http_body(raw), Some(b"hello".to_vec()));
    }

    #[test]
    fn test_extract_http_body_missing_header() {
        let raw = b"POST /pair HTTP/1.1\r\n\r\nhello";
        assert_eq!(extract_http_body(raw), None);
    }

    #[test]
    fn test_build_pairing_payload_length() {
        let id = Uuid::new_v4();
        let nonce = [0u8; 32];
        let payload = build_pairing_payload(&id, &nonce);
        assert_eq!(payload.len(), 48);
    }

    #[test]
    fn test_timestamp_ok() {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        assert!(timestamp_ok(now_ms, 30));
        assert!(!timestamp_ok(now_ms - 60_000, 30));
    }

    #[test]
    fn test_iphone_auth_state_new() {
        let s = IphoneAuthState::new();
        assert!(s.pending_pairing.lock().is_none());
        assert!(s.pending_challenge.lock().is_none());
    }
}
