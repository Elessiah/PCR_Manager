use crate::db::DbState;
use crate::models::Document;
use crate::auth_iphone;
use std::path::PathBuf;
use uuid::Uuid;
use chrono;
use tauri::Manager;

fn validate_source_path(p: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(p);
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| { eprintln!("[ERR] canonicalize: {}", e); "Chemin source invalide".to_string() })?;
    if canonical.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Chemin source invalide".to_string());
    }
    if !canonical.exists() {
        return Err("Chemin source invalide".to_string());
    }
    Ok(canonical)
}

fn delete_document_record(tx: &rusqlite::Transaction, id: i64) -> Result<String, String> {
    let chemin_relatif: String = tx
        .query_row("SELECT chemin_relatif FROM document WHERE id = ?1", [id], |row| {
            row.get(0)
        })
        .map_err(|e| { eprintln!("[ERR] {}", e); "Une erreur est survenue".to_string() })?;
    tx.execute("DELETE FROM document WHERE id = ?1", [id])
        .map_err(|e| { eprintln!("[ERR] {}", e); "Une erreur est survenue".to_string() })?;
    Ok(chemin_relatif)
}

#[tauri::command]
pub async fn document_list(session: tauri::State<'_, auth_iphone::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<Document>, String> {
    ensure_authenticated(&session)?;
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
pub async fn document_get(id: i64, session: tauri::State<'_, auth_iphone::SessionState>, state: tauri::State<'_, DbState>) -> Result<Document, String> {
    ensure_authenticated(&session)?;
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
    session: tauri::State<'_, auth_iphone::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Document, String> {
    eprintln!("[AUDIT] document_upload source={}", source_path);
    ensure_authenticated(&session)?;
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    let docs_dir = app_data_dir.join("documents");
    std::fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;

    let source_path_validated = validate_source_path(&source_path)?;
    let ext = source_path_validated
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("bin");
    let uuid_name = format!("{}.{}", Uuid::new_v4(), ext);
    let dest_path = docs_dir.join(&uuid_name);

    std::fs::copy(&source_path_validated, &dest_path).map_err(|e| e.to_string())?;

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
pub async fn document_delete(
    app_handle: tauri::AppHandle,
    id: i64,
    session: tauri::State<'_, auth_iphone::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    eprintln!("[AUDIT] document_delete id={}", id);
    ensure_authenticated(&session)?;
    let mut conn = state.conn.lock();

    let tx = conn.transaction()
        .map_err(|e| { eprintln!("[ERR] {}", e); "Une erreur est survenue".to_string() })?;
    let chemin_relatif = delete_document_record(&tx, id)?;
    tx.commit()
        .map_err(|e| { eprintln!("[ERR] {}", e); "Une erreur est survenue".to_string() })?;

    drop(conn);

    let abs_path = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join(&chemin_relatif);
    let _ = std::fs::remove_file(&abs_path);

    Ok(())
}

fn ensure_authenticated(session: &auth_iphone::SessionState) -> Result<(), String> {
    if !*session.authenticated.lock() {
        return Err("Non authentifié".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_authenticated_when_false_returns_err() {
        let session = auth_iphone::SessionState::new();
        assert!(ensure_authenticated(&session).is_err());
    }

    #[test]
    fn test_ensure_authenticated_when_true_returns_ok() {
        let session = auth_iphone::SessionState::new();
        *session.authenticated.lock() = true;
        assert!(ensure_authenticated(&session).is_ok());
    }

    #[test]
    fn test_validate_source_path_nominal() {
        let temp_file = tempfile::NamedTempFile::new()
            .expect("Failed to create temp file");
        let path_str = temp_file.path().to_str().unwrap();
        let result = validate_source_path(path_str);
        assert!(result.is_ok());
        let canonical = result.unwrap();
        assert!(canonical.exists());
    }

    #[test]
    fn test_validate_source_path_rejects_nonexistent() {
        let result = validate_source_path("/nonexistent/path/to/file.txt");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Chemin source invalide");
    }

    #[test]
    fn test_validate_source_path_rejects_dotdot() {
        let result = validate_source_path("../../../etc/passwd");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Chemin source invalide");
    }

    #[test]
    fn test_delete_document_record_returns_chemin() {
        let mut conn = rusqlite::Connection::open_in_memory()
            .expect("Failed to open in-memory DB");
        conn.execute(
            "CREATE TABLE document(id INTEGER PRIMARY KEY, chemin_relatif TEXT)",
            [],
        )
        .expect("Failed to create table");
        conn.execute(
            "INSERT INTO document(id, chemin_relatif) VALUES(1, 'documents/test.txt')",
            [],
        )
        .expect("Failed to insert");

        let tx = conn.transaction().expect("Failed to start transaction");
        let chemin = delete_document_record(&tx, 1).expect("Failed to delete");
        tx.commit().expect("Failed to commit");

        assert_eq!(chemin, "documents/test.txt");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM document WHERE id = 1", [], |row| {
                row.get(0)
            })
            .expect("Failed to count");
        assert_eq!(count, 0);
    }

    #[test]
    fn test_delete_document_record_unknown_id() {
        let mut conn = rusqlite::Connection::open_in_memory()
            .expect("Failed to open in-memory DB");
        conn.execute(
            "CREATE TABLE document(id INTEGER PRIMARY KEY, chemin_relatif TEXT)",
            [],
        )
        .expect("Failed to create table");

        let tx = conn.transaction().expect("Failed to start transaction");
        let result = delete_document_record(&tx, 999);
        assert!(result.is_err());
    }
}
