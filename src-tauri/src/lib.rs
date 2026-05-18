mod db;
mod auth;
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
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
            commands::competence::appareil_competence_add,
            commands::competence::appareil_competence_remove,
            commands::competence::appareil_competence_list
        ])
        .run(tauri::generate_context!())
        .expect("erreur Tauri");
}
