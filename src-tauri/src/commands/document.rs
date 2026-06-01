use crate::db::DbState;
use crate::models::Document;
use crate::auth_totp;
use std::path::{PathBuf, Path};
use uuid::Uuid;
use chrono;
use tauri::Manager;

fn resolve_safe_document_path(base: &Path, chemin_relatif: &str) -> Result<PathBuf, String> {
    if chemin_relatif.is_empty() {
        return Err("Chemin de document invalide".to_string());
    }
    if chemin_relatif.contains('\0') {
        return Err("Chemin de document invalide".to_string());
    }
    let path = PathBuf::from(chemin_relatif);
    if path.is_absolute() {
        return Err("Chemin de document invalide".to_string());
    }
    for component in path.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("Chemin de document invalide".to_string());
        }
    }
    let mut found_documents = false;
    for component in path.components() {
        if let std::path::Component::Normal(name) = component {
            if name.to_string_lossy() == "documents" {
                found_documents = true;
                break;
            }
        }
    }
    if !found_documents {
        return Err("Chemin de document invalide".to_string());
    }
    Ok(base.join(chemin_relatif))
}

fn validate_source_path(p: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(p);
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| { eprintln!("[ERR] canonicalize: {}", e); "Chemin source invalide".to_string() })?;
    if canonical.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Chemin source invalide".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        use std::path::Prefix;
        if let Some(std::path::Component::Prefix(p)) = canonical.components().next() {
            if matches!(p.kind(), Prefix::UNC(_, _) | Prefix::DeviceNS(_)) {
                return Err("Chemin réseau non autorisé".to_string());
            }
        }
    }
    if std::fs::metadata(&canonical).map(|m| m.len()).unwrap_or(0) > 50 * 1024 * 1024 {
        return Err("Fichier source trop volumineux (max 50 Mo)".to_string());
    }
    const ALLOWED_EXT: &[&str] = &["pdf", "jpg", "jpeg", "png", "doc", "docx"];
    let ext_low = canonical.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if !ALLOWED_EXT.contains(&ext_low.as_str()) {
        return Err("Extension de fichier non autorisée".to_string());
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
pub async fn document_list(session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Vec<Document>, String> {
    crate::auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
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
pub async fn document_get(id: i64, session: tauri::State<'_, auth_totp::SessionState>, state: tauri::State<'_, DbState>) -> Result<Document, String> {
    crate::auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
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
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Document, String> {
    eprintln!("[AUDIT] document_upload source={}", source_path);
    crate::auth_totp::ensure_authenticated(&session)?;
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

    let conn = state.get()?;
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
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    eprintln!("[AUDIT] document_delete id={}", id);
    crate::auth_totp::ensure_authenticated(&session)?;
    let mut conn = state.get()?;

    let tx = conn.transaction()
        .map_err(|e| { eprintln!("[ERR] {}", e); "Une erreur est survenue".to_string() })?;
    let chemin_relatif = delete_document_record(&tx, id)?;
    tx.commit()
        .map_err(|e| { eprintln!("[ERR] {}", e); "Une erreur est survenue".to_string() })?;

    drop(conn);

    let app_local_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    if let Ok(abs_path) = resolve_safe_document_path(&app_local_data_dir, &chemin_relatif) {
        let _ = std::fs::remove_file(&abs_path);
    }

    Ok(())
}

#[tauri::command]
pub async fn document_list_for_entity(
    entity_type: String,
    entity_id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Document>, String> {
    crate::auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let mut stmt = conn
        .prepare("SELECT id, entity_type, entity_id, type_document, nom_fichier, chemin_relatif, uploaded_at FROM document WHERE entity_type = ?1 AND entity_id = ?2 ORDER BY uploaded_at DESC")
        .map_err(|e| e.to_string())?;

    let documents = stmt
        .query_map(rusqlite::params![entity_type, entity_id], |row| {
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
pub async fn document_pick_and_upload(
    app_handle: tauri::AppHandle,
    entity_type: String,
    entity_id: i64,
    type_document: String,
    replace_document_id: Option<i64>,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<Option<Document>, String> {
    crate::auth_totp::ensure_authenticated(&session)?;

    let file = rfd::AsyncFileDialog::new()
        .add_filter("PDF", &["pdf"])
        .pick_file()
        .await;

    let file = match file {
        Some(f) => f,
        None => return Ok(None),
    };

    let source_path = file.path().to_path_buf();
    let nom_fichier = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.pdf")
        .to_string();

    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    let docs_dir = app_data_dir.join("documents");
    std::fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;

    let ext = source_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("pdf");
    const ALLOWED_PICK_EXT: &[&str] = &["pdf", "jpg", "jpeg", "png", "doc", "docx"];
    if !ALLOWED_PICK_EXT.contains(&ext.to_lowercase().as_str()) {
        return Err("Extension de fichier non autorisée".to_string());
    }
    if std::fs::metadata(&source_path).map(|m| m.len()).unwrap_or(0) > 50 * 1024 * 1024 {
        return Err("Fichier source trop volumineux (max 50 Mo)".to_string());
    }
    let uuid_name = format!("{}.{}", Uuid::new_v4(), ext);
    let dest_path = docs_dir.join(&uuid_name);

    std::fs::copy(&source_path, &dest_path).map_err(|e| e.to_string())?;

    let chemin_relatif = format!("documents/{}", uuid_name);

    let conn = state.get()?;
    conn.execute(
        "INSERT INTO document (entity_type, entity_id, type_document, nom_fichier, chemin_relatif) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![entity_type, entity_id, type_document, nom_fichier, chemin_relatif],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    if let Some(old_id) = replace_document_id {
        let old_chemin: Option<String> = conn
            .query_row("SELECT chemin_relatif FROM document WHERE id = ?1", [old_id], |row| row.get(0))
            .ok();
        let _ = conn.execute("DELETE FROM document WHERE id = ?1", [old_id]);
        if let Some(old_chemin) = old_chemin {
            let _ = std::fs::remove_file(app_data_dir.join(&old_chemin));
        }
    }

    eprintln!("[AUDIT] document_pick_and_upload entity_type={} entity_id={} type={} file={}", entity_type, entity_id, type_document, nom_fichier);

    Ok(Some(Document {
        id,
        entity_type,
        entity_id,
        type_document,
        nom_fichier,
        chemin_relatif,
        uploaded_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    }))
}

#[tauri::command]
pub async fn document_open(
    app_handle: tauri::AppHandle,
    id: i64,
    session: tauri::State<'_, auth_totp::SessionState>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    crate::auth_totp::ensure_authenticated(&session)?;
    let conn = state.get()?;
    let chemin_relatif: String = conn
        .query_row("SELECT chemin_relatif FROM document WHERE id = ?1", [id], |row| row.get(0))
        .map_err(|_| "Document non trouvé".to_string())?;

    let app_local_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let abs_path = resolve_safe_document_path(&app_local_data_dir, &chemin_relatif)?;

    open_with_system_default(&abs_path)
}

#[cfg(target_os = "windows")]
fn open_with_system_default(path: &std::path::Path) -> Result<(), String> {
    std::process::Command::new("cmd")
        .arg("/c")
        .arg("start")
        .arg("")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Impossible d'ouvrir le fichier : {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_with_system_default(path: &std::path::Path) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Impossible d'ouvrir le fichier : {}", e))?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn open_with_system_default(_path: &std::path::Path) -> Result<(), String> {
    Err("Ouverture non supportée sur cette plateforme".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_source_path_nominal() {
        let temp_file = tempfile::Builder::new()
            .suffix(".pdf")
            .tempfile()
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

    #[test]
    fn test_validate_source_path_rejects_unknown_extension() {
        let temp_file = tempfile::Builder::new()
            .suffix(".exe")
            .tempfile()
            .expect("Failed to create temp file");
        let path_str = temp_file.path().to_str().unwrap();
        let result = validate_source_path(path_str);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Extension"));
    }

    #[test]
    fn test_validate_source_path_allows_pdf() {
        let temp_file = tempfile::Builder::new()
            .suffix(".pdf")
            .tempfile()
            .expect("Failed to create temp file");
        let path_str = temp_file.path().to_str().unwrap();
        let result = validate_source_path(path_str);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_source_path_allows_jpg() {
        let temp_file = tempfile::Builder::new()
            .suffix(".jpg")
            .tempfile()
            .expect("Failed to create temp file");
        let path_str = temp_file.path().to_str().unwrap();
        let result = validate_source_path(path_str);
        assert!(result.is_ok());
    }

    #[test]
    fn test_resolve_safe_document_path_accepts_nominal() {
        let base = PathBuf::from("/app/data");
        let result = resolve_safe_document_path(&base, "documents/abc.pdf");
        assert!(result.is_ok());
        let resolved = result.unwrap();
        assert!(resolved.to_string_lossy().contains("documents/abc.pdf"));
    }

    #[test]
    fn test_resolve_safe_document_path_rejects_parent_dir() {
        let base = PathBuf::from("/app/data");
        let result = resolve_safe_document_path(&base, "../../etc/passwd");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Chemin de document invalide");
    }

    #[test]
    fn test_resolve_safe_document_path_rejects_absolute_path() {
        let base = PathBuf::from("/app/data");
        let result = resolve_safe_document_path(&base, "/etc/passwd");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Chemin de document invalide");
    }

    #[test]
    fn test_resolve_safe_document_path_rejects_missing_documents_prefix() {
        let base = PathBuf::from("/app/data");
        let result = resolve_safe_document_path(&base, "other/abc.pdf");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Chemin de document invalide");
    }

    #[test]
    fn test_resolve_safe_document_path_rejects_empty() {
        let base = PathBuf::from("/app/data");
        let result = resolve_safe_document_path(&base, "");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Chemin de document invalide");
    }

    #[test]
    fn test_resolve_safe_document_path_rejects_nul_byte() {
        let base = PathBuf::from("/app/data");
        let result = resolve_safe_document_path(&base, "documents/file\0.pdf");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Chemin de document invalide");
    }
}
