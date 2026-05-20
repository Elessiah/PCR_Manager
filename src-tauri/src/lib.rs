mod db;
mod auth_totp;
mod auth_mac;
mod models;
mod commands;
mod validators;

use tauri::Manager;

const LOCALHOST_PORT: u16 = 1420;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(LOCALHOST_PORT).build())
        .setup(|app| {
            // Mode Mac Keychain (mac_wrapped_db_key.bin) : DB ouverte après mot de passe macOS.
            // Mode TOTP (secret dans le Keychain) : DB ouverte après code Google Authenticator.
            // Mode legacy (première installation) : DB ouverte immédiatement pour permettre l'activation.
            let conn_opt = if db::has_mac_wrapped_key(app.handle()) {
                None
            } else if auth_totp::has_totp() {
                None
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
            app.manage(auth_totp::SessionState::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            db::init_db,
            auth_totp::session_check,
            auth_totp::logout,
            auth_totp::totp_available,
            auth_totp::totp_setup_start,
            auth_totp::totp_setup_confirm,
            auth_totp::totp_login,
            auth_totp::totp_revoke,
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
        ])
        .run(tauri::generate_context!())
        .expect("erreur Tauri");
}
