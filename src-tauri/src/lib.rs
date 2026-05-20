mod db;
mod auth_iphone;
mod auth_mac;
mod ecies;
mod models;
mod commands;
mod validators;

use tauri::Manager;

/// Port du serveur localhost (production ET dev Vite).
/// En production, tauri-plugin-localhost sert le frontend depuis http://localhost:1420.
/// En dev, Vite tourne déjà sur 1420 (le plugin n'est pas utilisé).
const LOCALHOST_PORT: u16 = 1420;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

/// Vérifie si le Wi-Fi est présent et activé sur macOS.
/// Retourne { available: bool, enabled: bool }.
#[tauri::command]
fn wifi_check() -> serde_json::Value {
    wifi_check_impl()
}

/// Ouvre le panneau Wi-Fi dans les Réglages Système macOS.
#[tauri::command]
fn wifi_open_settings() {
    wifi_open_settings_impl();
}

// ── macOS ─────────────────────────────────────────────────────────────────────

/// Vérifie l'état Wi-Fi via `networksetup -getairportpower Wi-Fi`.
/// Sortie attendue : "Wi-Fi Power (en0): On" ou "Wi-Fi Power (en0): Off".
/// Si l'interface Wi-Fi est absente, la commande échoue → available: false.
fn wifi_check_impl() -> serde_json::Value {
    let Ok(output) = std::process::Command::new("networksetup")
        .args(["-getairportpower", "Wi-Fi"])
        .output()
    else {
        return serde_json::json!({ "available": false, "enabled": false });
    };
    let text = String::from_utf8_lossy(&output.stdout);
    if text.trim().is_empty() {
        return serde_json::json!({ "available": false, "enabled": false });
    }
    let enabled = text.contains(": On");
    serde_json::json!({ "available": true, "enabled": enabled })
}

/// Ouvre les Réglages Système → Wi-Fi (macOS 13+).
/// Sur macOS 12 et antérieurs, le schéma x-apple.systempreferences est redirigé automatiquement.
fn wifi_open_settings_impl() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.wifi")
        .spawn();
}

pub fn run() {
    tauri::Builder::default()
        // Sert le frontend depuis http://localhost:LOCALHOST_PORT en production
        // (en dev, Tauri utilise directement devUrl = http://localhost:1420)
        .plugin(tauri_plugin_localhost::Builder::new(LOCALHOST_PORT).build())
        .setup(|app| {
            // Mode Mac Keychain protégé (wrapped_mac_db_key.bin présent) : DB ouverte après Touch ID ou mot de passe.
            // Mode iPhone (wrapped_db_key.bin présent) : la DB sera ouverte après auth.
            // Mode legacy (pas de bundle) : ouverture immédiate avec la clé du keyring.
            let conn_opt = if db::has_mac_wrapped_key(app.handle()) {
                None  // mode Secure Enclave Mac : DB ouverte après Touch ID
            } else if db::has_wrapped_key(app.handle()) {
                None  // mode iPhone : DB ouverte après auth iPhone
            } else {
                let conn = db::open_and_migrate(app.handle(), None)
                    .map_err(|e| tauri::Error::Io(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        e.to_string(),
                    )))?;
                Some(conn)
            };

            app.manage(db::DbState {
                conn: parking_lot::Mutex::new(conn_opt),
            });

            app.manage(auth_iphone::SessionState::new());
            app.manage(auth_iphone::IphoneAuthState::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            wifi_check,
            wifi_open_settings,
            db::init_db,
            auth_iphone::session_check,
            auth_iphone::iphone_logout,
            auth_mac::mac_auth_available,
            auth_mac::mac_auth_start,
            auth_mac::mac_se_activate,
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
            commands::travailleur::journal_acces_list,
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
            commands::document::document_list_for_entity,
            commands::document::document_pick_and_upload,
            commands::document::document_open,
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
            auth_iphone::iphone_network_available,
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
