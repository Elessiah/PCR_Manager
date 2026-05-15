use crate::db::DbState;
use crate::models::Document;
use std::path::Path;
use uuid::Uuid;
use chrono;

#[tauri::command]
pub async fn document_list(state: tauri::State<'_, DbState>) -> Result<Vec<Document>, String> {
    let conn = state.conn.lock();
    let mut stmt = conn
        .prepare("SELECT id, entity_type, entity_id, type_document, nom_fichier, chemin_relatif, uploaded_at FROM document ORDER BY id")
        .map_err(|e| e.to_string())?;

    let documents = stmt
        .query_map([], |row| {
            Ok(Document {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                type_document: row.get(3)?,
                nom_fichier: row.get(4)?,
                chemin_relatif: row.get(5)?,
                uploaded_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(documents)
}

#[tauri::command]
pub async fn document_get(id: i64, state: tauri::State<'_, DbState>) -> Result<Document, String> {
    let conn = state.conn.lock();
    let mut stmt = conn
        .prepare("SELECT id, entity_type, entity_id, type_document, nom_fichier, chemin_relatif, uploaded_at FROM document WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let document = stmt
        .query_row([id], |row| {
            Ok(Document {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                type_document: row.get(3)?,
                nom_fichier: row.get(4)?,
                chemin_relatif: row.get(5)?,
                uploaded_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(document)
}

#[tauri::command]
pub async fn document_upload(
    app_handle: tauri::AppHandle,
    entity_type: String,
    entity_id: i64,
    type_document: String,
    nom_fichier: String,
    source_path: String,
    state: tauri::State<'_, DbState>,
) -> Result<Document, String> {
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    let docs_dir = app_data_dir.join("documents");
    std::fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;

    let source_path = Path::new(&source_path);
    let ext = source_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("bin");
    let uuid_name = format!("{}.{}", Uuid::new_v4(), ext);
    let dest_path = docs_dir.join(&uuid_name);

    std::fs::copy(&source_path, &dest_path).map_err(|e| e.to_string())?;

    let chemin_relatif = format!("documents/{}", uuid_name);

    let conn = state.conn.lock();
    conn.execute(
        "INSERT INTO document (entity_type, entity_id, type_document, nom_fichier, chemin_relatif)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![entity_type, entity_id, type_document, nom_fichier, chemin_relatif],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Document {
        id,
        entity_type,
        entity_id,
        type_document,
        nom_fichier,
        chemin_relatif,
        uploaded_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub async fn document_delete(id: i64, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock();

    let chemin_relatif: String = conn
        .query_row("SELECT chemin_relatif FROM document WHERE id = ?1", [id], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM document WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;

    drop(conn);

    Ok(())
}
