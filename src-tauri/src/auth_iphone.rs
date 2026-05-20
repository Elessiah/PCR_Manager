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
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
use sha2::{Digest, Sha256};

use tauri::Manager;

use crate::db::DbState;

// ─────────────────────────────────────────────────────────────────────────────
// Session (remplace l'ancien auth.rs)
// ─────────────────────────────────────────────────────────────────────────────

pub struct SessionState {
    pub authenticated: Mutex<bool>,
}

impl SessionState {
    pub fn new() -> Self {
        Self { authenticated: Mutex::new(false) }
    }
}

#[tauri::command]
pub fn session_check(session: tauri::State<'_, SessionState>) -> serde_json::Value {
    serde_json::json!({ "authenticated": *session.authenticated.lock() })
}

#[tauri::command]
pub fn iphone_logout(
    app: tauri::AppHandle,
    session: tauri::State<'_, SessionState>,
    db: tauri::State<'_, DbState>,
) -> Result<(), String> {
    *session.authenticated.lock() = false;
    // En mode iPhone (wrapped_db_key.bin présent) : fermer la connexion DB
    // pour que les données soient inaccessibles jusqu'à la prochaine auth.
    // En mode Mac SE (wrapped_mac_key.bin présent) : idem.
    if crate::db::has_wrapped_key(&app) || crate::db::has_mac_wrapped_key(&app) {
        *db.conn.lock() = None;
    }
    Ok(())
}

/// Retourne true si un réseau local est disponible (adresse IP locale joignable).
/// Utilisé par le frontend pour griser les boutons d'appairage/auth quand le Wi-Fi est absent.
#[tauri::command]
pub fn iphone_network_available() -> bool {
    get_local_ip().is_some()
}

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
    _invitation_id: Uuid,
    _nonce: [u8; 32],
    created_at: Instant,
    result: Arc<Mutex<PairingResult>>,
}

#[derive(Clone)]
enum PairingResult {
    Pending,
    Completed {
        iphone_device_id: String,
        iphone_device_name: String,
        iphone_public_key: Vec<u8>,          // clé ECDSA (signature)
        iphone_ka_public_key: Option<Vec<u8>>, // clé KA (protocole v2)
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
    Verified { new_counter: u64, db_key: Option<String> },
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
    /// P-256 uncompressed point (65 bytes), base64url — clé ECDSA de signature
    iphone_identity_public_key: String,
    /// P-256 uncompressed point (65 bytes), base64url — clé P-256 Key Agreement (protocole v2)
    /// Absente pour les clients v1 (rétrocompatibilité).
    #[serde(default)]
    iphone_ka_public_key: Option<String>,
    /// DER-encoded ECDSA signature, base64url
    signature: String,
    timestamp_ms: i64,
}

// iPhone → Mac lors de l'authentification (HTTP POST /auth)
#[derive(Deserialize)]
struct AuthRequest {
    challenge_id: String,
    #[allow(dead_code)]
    device_id: String,
    /// DER-encoded ECDSA signature, base64url
    signature: String,
    counter: u64,
    timestamp_ms: i64,
    /// Clé DB déchiffrée par l'iPhone via ECIES (protocole v2).
    /// Transmise en base64url (32 octets raw → clé hex convertie par le Mac).
    #[serde(default)]
    db_key: Option<String>,
}

// Résultat parsé de la requête de pairing
#[derive(Debug)]
struct ProcessedPairing {
    iphone_device_id: String,
    iphone_device_name: String,
    iphone_public_key: Vec<u8>,       // clé ECDSA (signature)
    iphone_ka_public_key: Option<Vec<u8>>, // clé KA (key agreement), protocole v2
}

// ─────────────────────────────────────────────────────────────────────────────
// Métadonnées d'appairage (fichier JSON non-chiffré — clés publiques uniquement)
// Permet d'identifier les appareils et de vérifier les signatures AVANT
// que la DB SQLCipher soit ouverte (bootstrap du mode auth iPhone).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Default)]
struct PairingsMeta {
    version: u32,
    pairings: Vec<PairingMetaEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
struct PairingMetaEntry {
    pairing_id: String,
    device_name: String,
    device_id: String,
    /// Clé publique ECDSA P-256 x963, base64url (65 octets)
    signing_pub_key: String,
    /// Clé publique P-256 Key Agreement x963, base64url (65 octets) — protocole v2
    ka_pub_key: Option<String>,
    auth_counter: u64,
    active: bool,
}

fn pairings_meta_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .map(|p| p.join("pairings_meta.json"))
        .unwrap_or_else(|_| PathBuf::from("pairings_meta.json"))
}

fn read_pairings_meta(app: &tauri::AppHandle) -> PairingsMeta {
    std::fs::read_to_string(pairings_meta_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_pairings_meta(app: &tauri::AppHandle, meta: &PairingsMeta) {
    if let Ok(json) = serde_json::to_string_pretty(meta) {
        let _ = std::fs::write(pairings_meta_path(app), json);
    }
}

fn update_pairings_meta_counter(app: &tauri::AppHandle, pairing_id: &str, new_counter: u64) {
    let mut meta = read_pairings_meta(app);
    if let Some(entry) = meta.pairings.iter_mut().find(|p| p.pairing_id == pairing_id) {
        entry.auth_counter = new_counter;
    }
    write_pairings_meta(app, &meta);
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

    // Clé Key Agreement (protocole v2, optionnelle)
    let iphone_ka_public_key = if let Some(ka_b64) = req.iphone_ka_public_key {
        let ka_bytes =
            URL_SAFE_NO_PAD.decode(&ka_b64).map_err(|e| e.to_string())?;
        // Vérifier que c'est bien un point P-256 valide
        p256::EncodedPoint::from_bytes(&ka_bytes).map_err(|_| "Point KA P-256 invalide")?;
        Some(ka_bytes)
    } else {
        None
    };

    Ok(ProcessedPairing {
        iphone_device_id: req.iphone_device_id,
        iphone_device_name: req.iphone_device_name,
        iphone_public_key: pub_bytes,
        iphone_ka_public_key,
    })
}

/// Retourne (nouveau_compteur, db_key_optionnel).
/// Le db_key est transmis tel quel depuis l'iPhone (base64url, protocole v2).
fn process_auth_request(
    body: &[u8],
    challenge: &PendingChallenge,
) -> Result<(u64, Option<String>), String> {
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

    // Import de la clé publique ECDSA stockée lors de l'appairage
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

    Ok((req.counter, req.db_key))
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
                                iphone_ka_public_key: p.iphone_ka_public_key,
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
                        Ok((new_counter, db_key)) => {
                            http_ok(&mut stream);
                            *result.lock() = ChallengeResult::Verified { new_counter, db_key };
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
// Activation du mode key-wrapping ECIES (protocole v2)
// ─────────────────────────────────────────────────────────────────────────────

/// Appelée après un appairage v2 réussi :
/// 1. Génère une nouvelle clé DB aléatoire K_new
/// 2. Re-keye SQLCipher avec K_new (l'ancienne clé keyring devient caduque)
/// 3. Chiffre K_new avec la clé publique KA de l'iPhone (ECIES) → wrapped_db_key.bin
/// 4. Met à jour pairings_meta.json
///
/// Après cette opération, la DB ne peut être ouverte que via l'iPhone.
fn activate_iphone_key_wrapping(
    app: &tauri::AppHandle,
    db: &tauri::State<'_, DbState>,
    pairing_id: &str,
    device_id: &str,
    device_name: &str,
    signing_pub_key: &[u8],
    ka_pub_key: &[u8],
) -> Result<(), String> {
    // 1. Nouvelle clé DB (64 chars hex, 32 octets d'entropie)
    let k_new = crate::db::generate_db_key();

    // 2. Chiffrer K_new avec la clé KA de l'iPhone (ECIES)
    let bundle = crate::ecies::ecies_encrypt(ka_pub_key, k_new.as_bytes())
        .map_err(|e| format!("ECIES chiffrement échoué: {}", e))?;

    // 3. Écrire dans un fichier temporaire (atomicité : rename après rekey)
    let tmp_path  = crate::db::wrapped_key_path(app).with_extension("bin.tmp");
    let final_path = crate::db::wrapped_key_path(app);
    std::fs::write(&tmp_path, &bundle)
        .map_err(|e| format!("Écriture bundle ECIES (tmp): {}", e))?;

    // 4. Re-keyer la DB avec K_new
    {
        let conn = db.get()?;
        crate::db::rekey_db(&conn, &k_new)
            .map_err(|e| format!("PRAGMA rekey échoué: {}", e))?;
    }

    // 5. Rendre le bundle officiel (rename atomique)
    std::fs::rename(&tmp_path, &final_path)
        .map_err(|e| format!("Rename bundle ECIES: {}", e))?;

    // 6. Mettre à jour pairings_meta.json
    let mut meta = read_pairings_meta(app);
    meta.version = 2;
    meta.pairings.push(PairingMetaEntry {
        pairing_id: pairing_id.to_string(),
        device_name: device_name.to_string(),
        device_id: device_id.to_string(),
        signing_pub_key: URL_SAFE_NO_PAD.encode(signing_pub_key),
        ka_pub_key: Some(URL_SAFE_NO_PAD.encode(ka_pub_key)),
        auth_counter: 0,
        active: true,
    });
    write_pairings_meta(app, &meta);

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Commandes Tauri
// ─────────────────────────────────────────────────────────────────────────────

/// Retourne true si au moins un appairage iPhone actif existe.
/// Interroge la DB si disponible, sinon pairings_meta.json (bootstrap avant auth).
#[tauri::command]
pub async fn iphone_has_paired_device(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
) -> Result<bool, String> {
    if let Ok(conn) = db.get() {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM iphone_pairing WHERE active = 1",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        return Ok(count > 0);
    }
    // DB pas encore ouverte → lire le fichier de métadonnées
    Ok(read_pairings_meta(&app).pairings.iter().any(|p| p.active))
}

/// Liste tous les appareils iPhone appairés.
/// Interroge la DB si disponible, sinon pairings_meta.json.
#[tauri::command]
pub async fn iphone_pairing_list(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
) -> Result<Vec<PairedDevice>, String> {
    if let Ok(conn) = db.get() {
        let mut stmt = conn
            .prepare(
                "SELECT pairing_id, iphone_device_name, iphone_device_id,
                        paired_at, last_auth_at, auth_counter
                 FROM iphone_pairing WHERE active = 1
                 ORDER BY paired_at DESC",
            )
            .map_err(|e| e.to_string())?;

        return stmt
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
            .map_err(|e| e.to_string());
    }
    // DB pas encore ouverte → construire depuis les métadonnées
    let devices = read_pairings_meta(&app)
        .pairings
        .into_iter()
        .filter(|p| p.active)
        .map(|p| PairedDevice {
            pairing_id: p.pairing_id,
            iphone_device_name: p.device_name,
            iphone_device_id: p.device_id,
            paired_at: String::new(),
            last_auth_at: None,
            auth_counter: p.auth_counter,
        })
        .collect();
    Ok(devices)
}

/// Révoque un appairage (soft delete). Synchronise la DB et pairings_meta.json.
#[tauri::command]
pub async fn iphone_pairing_revoke(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
    pairing_id: String,
) -> Result<(), String> {
    let conn = db.get()?;
    conn.execute(
        "UPDATE iphone_pairing SET active = 0 WHERE pairing_id = ?1",
        rusqlite::params![pairing_id],
    )
    .map_err(|e| e.to_string())?;

    // Synchroniser pairings_meta.json
    let mut meta = read_pairings_meta(&app);
    if let Some(entry) = meta.pairings.iter_mut().find(|p| p.pairing_id == pairing_id) {
        entry.active = false;
    }
    write_pairings_meta(&app, &meta);

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
        _invitation_id: invitation_id,
        _nonce: nonce,
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
    app: tauri::AppHandle,
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
        PairingResult::Completed { iphone_device_id, iphone_device_name, iphone_public_key, iphone_ka_public_key } => {
            let pairing_id = Uuid::new_v4();
            let pairing_id_str = pairing_id.to_string();

            // Insérer dans la DB (qui est forcément ouverte ici)
            {
                let conn = db.get()?;
                conn.execute(
                    "INSERT INTO iphone_pairing
                     (pairing_id, iphone_device_id, iphone_device_name, iphone_public_key, ka_public_key, auth_counter, paired_at, active)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0, datetime('now'), 1)",
                    rusqlite::params![
                        pairing_id_str,
                        iphone_device_id,
                        iphone_device_name,
                        iphone_public_key,
                        iphone_ka_public_key,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }

            // ── Protocole v2 : re-keying + ECIES bundle ─────────────────────
            if let Some(ref ka_pub_key) = iphone_ka_public_key {
                activate_iphone_key_wrapping(
                    &app,
                    &db,
                    &pairing_id_str,
                    &iphone_device_id,
                    &iphone_device_name,
                    &iphone_public_key,
                    ka_pub_key,
                )?;
            } else {
                // Protocole v1 : mettre à jour pairings_meta.json sans re-keying
                let mut meta = read_pairings_meta(&app);
                meta.version = 1;
                meta.pairings.push(PairingMetaEntry {
                    pairing_id: pairing_id_str.clone(),
                    device_name: iphone_device_name.clone(),
                    device_id: iphone_device_id.clone(),
                    signing_pub_key: URL_SAFE_NO_PAD.encode(&iphone_public_key),
                    ka_pub_key: None,
                    auth_counter: 0,
                    active: true,
                });
                write_pairings_meta(&app, &meta);
            }

            *pending_guard = None;
            Ok(PairingPollResponse {
                status: "completed".into(),
                pairing_id: Some(pairing_id_str),
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
/// En mode v2, inclut le bundle ECIES dans le QR pour que l'iPhone puisse
/// déchiffrer la clé DB et la renvoyer après vérification Face ID.
#[tauri::command]
pub async fn iphone_auth_challenge_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, IphoneAuthState>,
    db: tauri::State<'_, DbState>,
    pairing_id: String,
) -> Result<ChallengeStartResponse, String> {
    // Charger la clé publique ECDSA et le compteur :
    // - depuis la DB si elle est déjà ouverte (mode legacy ou même session)
    // - depuis pairings_meta.json si la DB n'est pas encore ouverte (bootstrap v2)
    let (iphone_public_key, current_counter) = if let Ok(conn) = db.get() {
        conn.query_row(
            "SELECT iphone_public_key, auth_counter FROM iphone_pairing
             WHERE pairing_id = ?1 AND active = 1",
            rusqlite::params![pairing_id],
            |r| Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, i64>(1)? as u64)),
        )
        .map_err(|_| "Appairage introuvable ou inactif".to_string())?
    } else {
        let meta = read_pairings_meta(&app);
        let entry = meta
            .pairings
            .iter()
            .find(|p| p.pairing_id == pairing_id && p.active)
            .ok_or("Appairage introuvable ou inactif")?;
        let pub_key_bytes = URL_SAFE_NO_PAD
            .decode(&entry.signing_pub_key)
            .map_err(|e| format!("Clé publique invalide: {}", e))?;
        (pub_key_bytes, entry.auth_counter)
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

    // En mode v2 (bundle ECIES présent), l'iPhone doit déchiffrer la clé DB
    // et la renvoyer dans sa réponse POST.
    let qr_data = if crate::db::has_wrapped_key(&app) {
        let bundle = std::fs::read(crate::db::wrapped_key_path(&app))
            .map_err(|e| format!("Lecture bundle ECIES: {}", e))?;
        let bundle_b64 = URL_SAFE_NO_PAD.encode(&bundle);
        format!(
            "pcrauth://auth?v=2&host={}&port={}&challenge_id={}&nonce={}&mac_id={}&pairing_id={}&counter={}&wrapped_key={}",
            local_ip, port, challenge_id, nonce_b64, mac_device_id, pairing_id_uuid, expected_counter, bundle_b64
        )
    } else {
        format!(
            "pcrauth://auth?v=1&host={}&port={}&challenge_id={}&nonce={}&mac_id={}&pairing_id={}&counter={}",
            local_ip, port, challenge_id, nonce_b64, mac_device_id, pairing_id_uuid, expected_counter
        )
    };

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

/// Interroge l'état du challenge en cours.
/// En mode v2, ouvre la DB avec la clé déchiffrée par l'iPhone.
#[tauri::command]
pub async fn iphone_auth_poll(
    app: tauri::AppHandle,
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
        ChallengeResult::Verified { new_counter, db_key } => {
            let pairing_id_str = pending.pairing_id.to_string();

            // ── Mode v2 : ouvrir la DB avec la clé fournie par l'iPhone ──────
            if let Some(ref key_b64) = db_key {
                // La DB n'est pas encore ouverte (mode iPhone activé)
                if db.get().is_err() {
                    // Décoder la clé raw (32 octets) et la convertir en hex
                    let key_bytes = URL_SAFE_NO_PAD
                        .decode(key_b64)
                        .map_err(|_| "db_key base64 invalide")?;
                    let hex_key: String =
                        key_bytes.iter().map(|b| format!("{:02x}", b)).collect();

                    let conn = crate::db::open_and_migrate(&app, Some(&hex_key))
                        .map_err(|e| format!("Impossible d'ouvrir la DB: {}", e))?;
                    *db.conn.lock() = Some(conn);
                }
                // Si la DB est déjà ouverte (premier appairage dans la même session),
                // on n'a pas besoin de la réouvrir.
            }

            // ── Mise à jour du compteur anti-rejeu ───────────────────────────
            if let Ok(conn) = db.get() {
                conn.execute(
                    "UPDATE iphone_pairing
                     SET auth_counter = ?1, last_auth_at = datetime('now')
                     WHERE pairing_id = ?2",
                    rusqlite::params![new_counter as i64, pairing_id_str],
                )
                .map_err(|e| e.to_string())?;
            }
            // Synchroniser dans pairings_meta.json (lu avant que la DB soit ouverte)
            update_pairings_meta_counter(&app, &pairing_id_str, new_counter);

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
    use p256::ecdsa::{signature::Signer, SigningKey};

    // ── Helpers crypto ────────────────────────────────────────────────────────

    fn random_signing_key() -> SigningKey {
        SigningKey::random(&mut rand::rngs::OsRng)
    }

    fn sign_b64(sk: &SigningKey, payload: &[u8]) -> String {
        let sig: Signature = sk.sign(payload);
        URL_SAFE_NO_PAD.encode(sig.to_der().as_bytes())
    }

    fn pub_key_b64(sk: &SigningKey) -> String {
        URL_SAFE_NO_PAD.encode(sk.verifying_key().to_encoded_point(false).as_bytes())
    }

    fn now_ms() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
    }

    fn make_pairing_body(
        sk: &SigningKey,
        invitation_id: &Uuid,
        nonce: &[u8],
        override_sig: Option<&str>,
        override_id: Option<&str>,
    ) -> Vec<u8> {
        let payload = build_pairing_payload(invitation_id, nonce);
        let sig = override_sig.map(str::to_owned).unwrap_or_else(|| sign_b64(sk, &payload));
        let id_str = override_id.map(str::to_owned).unwrap_or_else(|| invitation_id.to_string());
        serde_json::to_vec(&serde_json::json!({
            "invitation_id": id_str,
            "iphone_device_id": "test-device-id",
            "iphone_device_name": "iPhone de test",
            "iphone_identity_public_key": pub_key_b64(sk),
            "signature": sig,
            "timestamp_ms": now_ms(),
        }))
        .unwrap()
    }

    fn make_auth_body(
        sk: &SigningKey,
        challenge: &PendingChallenge,
        counter: u64,
        override_sig: Option<&str>,
        override_id: Option<&str>,
    ) -> Vec<u8> {
        let ts = now_ms();
        let payload = build_auth_payload(
            &challenge.challenge_id,
            &challenge.nonce,
            ts,
            &challenge.mac_device_id,
            counter,
        );
        let sig = override_sig.map(str::to_owned).unwrap_or_else(|| sign_b64(sk, &payload));
        let id_str = override_id
            .map(str::to_owned)
            .unwrap_or_else(|| challenge.challenge_id.to_string());
        serde_json::to_vec(&serde_json::json!({
            "challenge_id": id_str,
            "device_id": "test-device-id",
            "signature": sig,
            "timestamp_ms": ts,
            "counter": counter,
        }))
        .unwrap()
    }

    fn make_challenge(sk: &SigningKey, expected_counter: u64) -> PendingChallenge {
        PendingChallenge {
            challenge_id: Uuid::new_v4(),
            pairing_id: Uuid::new_v4(),
            nonce: random_nonce(),
            mac_device_id: "a".repeat(64),
            iphone_public_key: sk.verifying_key().to_encoded_point(false).as_bytes().to_vec(),
            created_at: Instant::now(),
            expected_counter,
            result: Arc::new(Mutex::new(ChallengeResult::Pending)),
        }
    }

    // ── SessionState ──────────────────────────────────────────────────────────

    #[test]
    fn test_session_state_starts_unauthenticated() {
        let s = SessionState::new();
        assert!(!*s.authenticated.lock());
    }

    #[test]
    fn test_session_state_can_authenticate() {
        let s = SessionState::new();
        *s.authenticated.lock() = true;
        assert!(*s.authenticated.lock());
    }

    #[test]
    fn test_session_state_can_logout() {
        let s = SessionState::new();
        *s.authenticated.lock() = true;
        *s.authenticated.lock() = false;
        assert!(!*s.authenticated.lock());
    }

    // ── IphoneAuthState ───────────────────────────────────────────────────────

    #[test]
    fn test_iphone_auth_state_new() {
        let s = IphoneAuthState::new();
        assert!(s.pending_pairing.lock().is_none());
        assert!(s.pending_challenge.lock().is_none());
    }

    // ── Payloads ──────────────────────────────────────────────────────────────

    #[test]
    fn test_build_pairing_payload_length() {
        let id = Uuid::new_v4();
        let nonce = [0u8; 32];
        let payload = build_pairing_payload(&id, &nonce);
        assert_eq!(payload.len(), 48); // 16 UUID + 32 nonce
    }

    #[test]
    fn test_build_pairing_payload_contains_uuid_bytes() {
        let id = Uuid::new_v4();
        let nonce = [0xABu8; 32];
        let payload = build_pairing_payload(&id, &nonce);
        assert_eq!(&payload[..16], id.as_bytes());
        assert_eq!(&payload[16..], &[0xABu8; 32]);
    }

    #[test]
    fn test_build_auth_payload_layout() {
        let challenge_id = Uuid::new_v4();
        let nonce = [0x01u8; 32];
        let ts: i64 = 1_700_000_000_000;
        let mac_id = "a".repeat(64);
        let counter: u64 = 42;
        let payload = build_auth_payload(&challenge_id, &nonce, ts, &mac_id, counter);

        // challenge_id (16) + nonce (32) + ts (8) + mac_id (64) + counter (8) + suffix (18)
        assert_eq!(payload.len(), 16 + 32 + 8 + 64 + 8 + 18);
        assert_eq!(&payload[..16], challenge_id.as_bytes());
        assert_eq!(&payload[16..48], &[0x01u8; 32]);
        assert_eq!(&payload[48..56], &ts.to_be_bytes());
        assert_eq!(&payload[56..120], mac_id.as_bytes());
        assert_eq!(&payload[120..128], &counter.to_be_bytes());
        assert_eq!(&payload[128..], b"com.pcrmanager.ios");
    }

    #[test]
    fn test_build_auth_payload_different_counters_differ() {
        let id = Uuid::new_v4();
        let nonce = random_nonce();
        let mac = "b".repeat(64);
        let ts = now_ms();
        let p1 = build_auth_payload(&id, &nonce, ts, &mac, 1);
        let p2 = build_auth_payload(&id, &nonce, ts, &mac, 2);
        assert_ne!(p1, p2);
    }

    // ── extract_http_body ─────────────────────────────────────────────────────

    #[test]
    fn test_extract_http_body_valid() {
        let raw = b"POST /pair HTTP/1.1\r\nContent-Length: 5\r\n\r\nhello";
        assert_eq!(extract_http_body(raw), Some(b"hello".to_vec()));
    }

    #[test]
    fn test_extract_http_body_missing_header() {
        let raw = b"POST /pair HTTP/1.1\r\n\r\nhello";
        assert_eq!(extract_http_body(raw), None);
    }

    #[test]
    fn test_extract_http_body_exact_content_length() {
        let body = b"12345678";
        let raw = format!("POST / HTTP/1.1\r\nContent-Length: 8\r\n\r\n")
            .into_bytes()
            .into_iter()
            .chain(body.iter().copied())
            .collect::<Vec<_>>();
        assert_eq!(extract_http_body(&raw), Some(body.to_vec()));
    }

    #[test]
    fn test_extract_http_body_empty_body() {
        let raw = b"POST / HTTP/1.1\r\nContent-Length: 0\r\n\r\n";
        assert_eq!(extract_http_body(raw), Some(vec![]));
    }

    // ── timestamp_ok ─────────────────────────────────────────────────────────

    #[test]
    fn test_timestamp_ok_now_is_valid() {
        assert!(timestamp_ok(now_ms(), 30));
    }

    #[test]
    fn test_timestamp_ok_60s_ago_fails_30s_window() {
        assert!(!timestamp_ok(now_ms() - 60_000, 30));
    }

    #[test]
    fn test_timestamp_ok_future_within_window() {
        assert!(timestamp_ok(now_ms() + 10_000, 30));
    }

    #[test]
    fn test_timestamp_ok_future_outside_window() {
        assert!(!timestamp_ok(now_ms() + 60_000, 30));
    }

    #[test]
    fn test_timestamp_ok_exactly_at_boundary() {
        // juste dans la fenêtre (29 999 ms < 30 000 ms)
        assert!(timestamp_ok(now_ms() - 29_999, 30));
    }

    // ── random_nonce ──────────────────────────────────────────────────────────

    #[test]
    fn test_random_nonce_length() {
        assert_eq!(random_nonce().len(), 32);
    }

    #[test]
    fn test_random_nonce_is_random() {
        let a = random_nonce();
        let b = random_nonce();
        assert_ne!(a, b, "deux nonces successifs ne doivent pas être identiques");
    }

    // ── process_pairing_request — crypto ─────────────────────────────────────

    #[test]
    fn test_process_pairing_valid_signature() {
        let sk = random_signing_key();
        let id = Uuid::new_v4();
        let nonce = random_nonce();
        let body = make_pairing_body(&sk, &id, &nonce, None, None);
        assert!(process_pairing_request(&body, &id, &nonce).is_ok());
    }

    #[test]
    fn test_process_pairing_wrong_invitation_id_in_json() {
        let sk = random_signing_key();
        let id = Uuid::new_v4();
        let nonce = random_nonce();
        let wrong_id = Uuid::new_v4().to_string();
        let body = make_pairing_body(&sk, &id, &nonce, None, Some(&wrong_id));
        let err = process_pairing_request(&body, &id, &nonce).unwrap_err();
        assert!(err.contains("invitation_id"), "erreur inattendue: {err}");
    }

    #[test]
    fn test_process_pairing_tampered_signature_fails() {
        let sk = random_signing_key();
        let id = Uuid::new_v4();
        let nonce = random_nonce();
        // signature valide pour un payload différent (autre nonce)
        let other_payload = build_pairing_payload(&Uuid::new_v4(), &random_nonce());
        let bad_sig = sign_b64(&sk, &other_payload);
        let body = make_pairing_body(&sk, &id, &nonce, Some(&bad_sig), None);
        let err = process_pairing_request(&body, &id, &nonce).unwrap_err();
        assert!(err.contains("Signature"), "erreur inattendue: {err}");
    }

    #[test]
    fn test_process_pairing_wrong_key_fails() {
        let sk_signer = random_signing_key();
        let sk_other  = random_signing_key();
        let id = Uuid::new_v4();
        let nonce = random_nonce();
        let payload = build_pairing_payload(&id, &nonce);
        // signe avec sk_signer mais déclare pub key de sk_other
        let sig = sign_b64(&sk_signer, &payload);
        let body = serde_json::to_vec(&serde_json::json!({
            "invitation_id": id.to_string(),
            "iphone_device_id": "dev",
            "iphone_device_name": "iPhone",
            "iphone_identity_public_key": pub_key_b64(&sk_other),
            "signature": sig,
            "timestamp_ms": now_ms(),
        }))
        .unwrap();
        assert!(process_pairing_request(&body, &id, &nonce).is_err());
    }

    #[test]
    fn test_process_pairing_invalid_json_fails() {
        let id = Uuid::new_v4();
        let nonce = random_nonce();
        let err = process_pairing_request(b"not json", &id, &nonce).unwrap_err();
        assert!(err.contains("JSON"), "erreur inattendue: {err}");
    }

    #[test]
    fn test_process_pairing_returns_correct_device_info() {
        let sk = random_signing_key();
        let id = Uuid::new_v4();
        let nonce = random_nonce();
        let payload = build_pairing_payload(&id, &nonce);
        let sig = sign_b64(&sk, &payload);
        let body = serde_json::to_vec(&serde_json::json!({
            "invitation_id": id.to_string(),
            "iphone_device_id": "uid-42",
            "iphone_device_name": "iPhone 15 Pro",
            "iphone_identity_public_key": pub_key_b64(&sk),
            "signature": sig,
            "timestamp_ms": now_ms(),
        }))
        .unwrap();
        let result = process_pairing_request(&body, &id, &nonce).unwrap();
        assert_eq!(result.iphone_device_id, "uid-42");
        assert_eq!(result.iphone_device_name, "iPhone 15 Pro");
        assert_eq!(result.iphone_public_key.len(), 65); // x963 uncompressed
    }

    // ── process_auth_request — crypto + anti-rejeu ───────────────────────────

    #[test]
    fn test_process_auth_valid_signature() {
        let sk = random_signing_key();
        let challenge = make_challenge(&sk, 0);
        let body = make_auth_body(&sk, &challenge, 1, None, None);
        let (counter, db_key) = process_auth_request(&body, &challenge).unwrap();
        assert_eq!(counter, 1);
        assert!(db_key.is_none()); // pas de db_key en v1
    }

    #[test]
    fn test_process_auth_counter_increments_accepted() {
        let sk = random_signing_key();
        let challenge = make_challenge(&sk, 5);
        let body = make_auth_body(&sk, &challenge, 6, None, None);
        let (counter, _) = process_auth_request(&body, &challenge).unwrap();
        assert_eq!(counter, 6);
    }

    #[test]
    fn test_process_auth_counter_replay_rejected() {
        let sk = random_signing_key();
        // expected_counter = 3 → req.counter doit être > 2 (saturating_sub(1))
        let challenge = make_challenge(&sk, 3);
        let body = make_auth_body(&sk, &challenge, 2, None, None);
        let err = process_auth_request(&body, &challenge).unwrap_err();
        assert!(err.contains("Compteur"), "erreur inattendue: {err}");
    }

    #[test]
    fn test_process_auth_wrong_challenge_id_rejected() {
        let sk = random_signing_key();
        let challenge = make_challenge(&sk, 0);
        let wrong_id = Uuid::new_v4().to_string();
        let body = make_auth_body(&sk, &challenge, 1, None, Some(&wrong_id));
        let err = process_auth_request(&body, &challenge).unwrap_err();
        assert!(err.contains("challenge_id"), "erreur inattendue: {err}");
    }

    #[test]
    fn test_process_auth_tampered_signature_rejected() {
        let sk = random_signing_key();
        let challenge = make_challenge(&sk, 0);
        let other_payload = build_auth_payload(
            &Uuid::new_v4(), &random_nonce(), now_ms(), &"x".repeat(64), 99,
        );
        let bad_sig = sign_b64(&sk, &other_payload);
        let body = make_auth_body(&sk, &challenge, 1, Some(&bad_sig), None);
        assert!(process_auth_request(&body, &challenge).is_err());
    }

    #[test]
    fn test_process_auth_wrong_key_rejected() {
        let sk_real  = random_signing_key();
        let sk_other = random_signing_key();
        // challenge enregistre la pub key de sk_real, mais sk_other signe
        let challenge = make_challenge(&sk_real, 0);
        let body = make_auth_body(&sk_other, &challenge, 1, None, None);
        assert!(process_auth_request(&body, &challenge).is_err());
    }

    #[test]
    fn test_process_auth_invalid_json_fails() {
        let sk = random_signing_key();
        let challenge = make_challenge(&sk, 0);
        let err = process_auth_request(b"garbage", &challenge).unwrap_err();
        assert!(err.contains("JSON"), "erreur inattendue: {err}");
    }

    // ── iphone_network_available ──────────────────────────────────────────────

    #[test]
    fn test_network_available_returns_bool() {
        // On vérifie juste que la fonction s'exécute sans paniquer.
        // La valeur dépend de l'environnement CI/réseau.
        let _ = iphone_network_available();
    }
}
