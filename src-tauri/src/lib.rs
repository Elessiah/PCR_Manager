mod db;
mod auth;
mod models;
mod commands;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

pub fn run() {
    tauri::Builder::default()
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

            // Initialize WebAuthn state
            let webauthn = webauthn_rs::prelude::Webauthn::new(
                "pcrmanager.local",
                &url::Url::parse("https://localhost")
                    .map_err(|e| tauri::Error::Io(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        e.to_string(),
                    )))?,
            )
            .map_err(|e| tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            )))?;

            app.manage(auth::WebauthnState {
                webauthn: std::sync::Arc::new(webauthn),
                reg_states: parking_lot::Mutex::new(std::collections::HashMap::new()),
                auth_states: parking_lot::Mutex::new(std::collections::HashMap::new()),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            db::init_db,
            auth::passkey_register_start,
            auth::passkey_register_finish,
            auth::passkey_auth_start,
            auth::passkey_auth_finish,
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
            commands::document::document_delete
        ])
        .run(tauri::generate_context!())
        .expect("erreur Tauri");
}
