mod db;
mod auth;
mod auth_iphone;
mod models;
mod commands;
mod validators;

use tauri::Manager;

/// Port du serveur localhost (production ET dev Vite).
/// En production, tauri-plugin-localhost sert le frontend depuis http://localhost:1420.
/// En dev, Vite tourne déjà sur 1420 (le plugin n'est pas utilisé).
/// → rp_origin WebAuthn est identique dans les deux environnements.
const LOCALHOST_PORT: u16 = 1420;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

/// Vérifie si un adaptateur Bluetooth est présent et activé (Windows + macOS).
/// Retourne { available: bool, enabled: bool }.
#[tauri::command]
fn bluetooth_check() -> serde_json::Value {
    bluetooth_check_impl()
}

/// Ouvre la page Paramètres Bluetooth du système (Windows + macOS).
#[tauri::command]
fn bluetooth_open_settings() {
    bluetooth_open_settings_impl();
}

// ── Windows ───────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn bluetooth_check_impl() -> serde_json::Value {
    let result = std::process::Command::new("powershell")
        .args([
            "-NoProfile", "-NonInteractive", "-Command",
            "$s = Get-Service 'bthserv' -ErrorAction SilentlyContinue; \
             if (!$s) { 'none' } elseif ($s.Status -eq 'Running') { 'on' } else { 'off' }",
        ])
        .output();
    let state = match result {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        Err(_) => "none".to_string(),
    };
    serde_json::json!({ "available": state != "none", "enabled": state == "on" })
}

#[cfg(target_os = "windows")]
fn bluetooth_open_settings_impl() {
    let _ = std::process::Command::new("cmd")
        .args(["/c", "start", "ms-settings:bluetooth"])
        .spawn();
}

// ── macOS ─────────────────────────────────────────────────────────────────────

/// Lit l'état du contrôleur Bluetooth via ioreg (disponible sur tout macOS).
/// BluetoothPowerState = 1 → activé, 0 → désactivé, absent → pas d'adaptateur.
#[cfg(target_os = "macos")]
fn bluetooth_check_impl() -> serde_json::Value {
    let Ok(output) = std::process::Command::new("ioreg")
        .args(["-l", "-n", "IOBluetoothHCIController"])
        .output()
    else {
        return serde_json::json!({ "available": false, "enabled": false });
    };
    let text = String::from_utf8_lossy(&output.stdout);
    if text.trim().is_empty() {
        return serde_json::json!({ "available": false, "enabled": false });
    }
    let enabled = text.contains("\"BluetoothPowerState\" = 1");
    serde_json::json!({ "available": true, "enabled": enabled })
}

/// Ouvre le panneau Bluetooth dans Préférences Système / Réglages Système
/// (fonctionne sur macOS 12 et antérieurs via System Preferences,
///  et sur macOS 13+ via System Settings grâce à la redirection du .prefPane).
#[cfg(target_os = "macos")]
fn bluetooth_open_settings_impl() {
    let _ = std::process::Command::new("open")
        .arg("/System/Library/PreferencePanes/Bluetooth.prefPane")
        .spawn();
}

// ── Autres plateformes (Linux…) ───────────────────────────────────────────────

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn bluetooth_check_impl() -> serde_json::Value {
    serde_json::json!({ "available": false, "enabled": false })
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn bluetooth_open_settings_impl() {}

pub fn run() {
    tauri::Builder::default()
        // Sert le frontend depuis http://localhost:LOCALHOST_PORT en production
        // (en dev, Tauri utilise directement devUrl = http://localhost:1420)
        .plugin(tauri_plugin_localhost::Builder::new(LOCALHOST_PORT).build())
        .setup(|app| {
            let conn = db::open_db(app.handle())
                .map_err(|e| tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e.to_string(),
                )))?;

            let mut conn = conn;
            db::run_migrations(&mut conn)
                .map_err(|e| tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e.to_string(),
                )))?;

            app.manage(db::DbState {
                conn: parking_lot::Mutex::new(conn),
            });

            // Origine principale (production) : http://localhost:LOCALHOST_PORT
            // Origine additionnelle (dev Vite) : http://localhost:1420
            // rp_id = "localhost" est valide pour toutes les origines localhost.
            // rp_origin = http://localhost:1420 car :
            //   - dev  : Vite sert sur :1420 → origin identique
            //   - prod : tauri-plugin-localhost sert aussi sur :1420
            let rp_id = "localhost";
            let rp_origin = url::Url::parse(&format!("http://localhost:{}", LOCALHOST_PORT))
                .map_err(|e| tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other, e.to_string(),
                )))?;

            let webauthn = webauthn_rs::WebauthnBuilder::new(rp_id, &rp_origin)
                .map_err(|e| tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other, e.to_string(),
                )))?
                .rp_name("PCR Manager")
                .build()
                .map_err(|e| tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other, e.to_string(),
                )))?;

            app.manage(auth::WebauthnState {
                webauthn: std::sync::Arc::new(webauthn),
                reg_states: parking_lot::Mutex::new(std::collections::HashMap::new()),
                auth_states: parking_lot::Mutex::new(std::collections::HashMap::new()),
            });

            app.manage(auth::SessionState::new());
            app.manage(auth_iphone::IphoneAuthState::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            bluetooth_check,
            bluetooth_open_settings,
            db::init_db,
            auth::passkey_has_credentials,
            auth::passkey_register_start,
            auth::passkey_register_finish,
            auth::passkey_auth_start,
            auth::passkey_auth_finish,
            auth::session_check,
            auth::passkey_logout,
            auth::dev_auth_bypass,
            commands::etablissement::etablissement_list,
            commands::etablissement::etablissement_get,
            commands::etablissement::etablissement_create,
            commands::etablissement::etablissement_update,
            commands::etablissement::etablissement_delete,
            commands::travailleur::travailleur_list,
            commands::travailleur::travailleur_get,
            commands::travailleur::travailleur_create,
            commands::travailleur::travailleur_update,
            commands::travailleur::travailleur_delete,
            commands::habilitation::habilitation_compute,
            commands::habilitation::habilitation_update,
            commands::habilitation::habilitation_get_for_travailleur,
            commands::competence::competence_list,
            commands::competence::competence_set,
            commands::competence::competence_get_for_travailleur,
            commands::competence::competence_ref_create,
            commands::competence::competence_ref_update,
            commands::competence::competence_ref_delete,
            commands::appareil::appareil_list,
            commands::appareil::appareil_get,
            commands::appareil::appareil_create,
            commands::appareil::appareil_update,
            commands::appareil::appareil_delete,
            commands::verification::verification_list,
            commands::verification::verification_get,
            commands::verification::verification_create,
            commands::verification::verification_update,
            commands::verification::verification_delete,
            commands::controle_qualite::controle_qualite_list,
            commands::controle_qualite::controle_qualite_get,
            commands::controle_qualite::controle_qualite_create,
            commands::controle_qualite::controle_qualite_update,
            commands::controle_qualite::controle_qualite_delete,
            commands::document::document_list,
            commands::document::document_get,
            commands::document::document_upload,
            commands::document::document_delete,
            commands::export_import::data_export,
            commands::export_import::data_import,
            commands::export_import::data_export_encrypted,
            commands::export_import::data_import_encrypted,
            commands::export_import::choose_save_path,
            commands::export_import::save_export_file,
            commands::competence::appareil_competence_add,
            commands::competence::appareil_competence_remove,
            commands::competence::appareil_competence_list,
            commands::competence::competence_general_set,
            commands::competence::competence_general_get_for_travailleur,
            commands::travailleur_appareil::travailleur_appareil_list,
            commands::travailleur_appareil::travailleur_appareil_add,
            commands::travailleur_appareil::travailleur_appareil_remove,
            auth_iphone::iphone_has_paired_device,
            auth_iphone::iphone_pairing_list,
            auth_iphone::iphone_pairing_revoke,
            auth_iphone::iphone_pairing_start,
            auth_iphone::iphone_pairing_poll,
            auth_iphone::iphone_auth_challenge_start,
            auth_iphone::iphone_auth_poll,
            auth_iphone::iphone_cancel_pending
        ])
        .run(tauri::generate_context!())
        .expect("erreur Tauri");
}
