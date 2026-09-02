use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScannedPdfFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub last_modified: u64,
    pub extension: String,
}

/// Retrieves the PDF file path passed as a command-line argument when opening via Windows double-click / file association
#[tauri::command]
fn get_cli_launch_file() -> Option<String> {
    for arg in std::env::args_os().skip(1) {
        let raw = arg.to_string_lossy().to_string();
        let clean = raw.trim().trim_matches('"').trim_matches('\'').to_string();
        
        // Skip CLI flags like -v, --flag
        if clean.starts_with("--") || (clean.starts_with('-') && clean.len() <= 3 && !clean.contains('/') && !clean.contains('\\')) {
            continue;
        }

        // Strip file:// prefix if present
        let normalized = if let Some(s) = clean.strip_prefix("file:///") {
            s.to_string()
        } else if let Some(s) = clean.strip_prefix("file://") {
            s.to_string()
        } else {
            clean.clone()
        };

        let path = Path::new(&normalized);
        let lower = normalized.to_lowercase();

        if lower.ends_with(".pdf") || path.is_file() || Path::new(&clean).is_file() {
            return Some(normalized);
        }
    }

    None
}

/// Reads raw binary bytes of a PDF file directly from disk
#[tauri::command]
fn read_pdf_file_binary(path: String) -> Result<Vec<u8>, String> {
    let clean = path.trim().trim_matches('"').trim_matches('\'').to_string();
    let normalized = if let Some(s) = clean.strip_prefix("file:///") {
        s.to_string()
    } else if let Some(s) = clean.strip_prefix("file://") {
        s.to_string()
    } else {
        clean.clone()
    };

    if let Ok(bytes) = fs::read(&normalized) {
        return Ok(bytes);
    }
    if let Ok(bytes) = fs::read(&clean) {
        return Ok(bytes);
    }
    fs::read(&path)
        .map_err(|e| format!("Failed to read PDF file '{}': {}", path, e))
}

/// Scans a directory for PDF files
#[tauri::command]
fn scan_pdf_directory(dir_path: String) -> Result<Vec<ScannedPdfFile>, String> {
    let path = Path::new(&dir_path);

    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    let mut pdf_files = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_path = entry.path();

            if file_path.is_file() {
                if let Some(ext) = file_path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "pdf" {
                        let name = file_path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| "document.pdf".to_string());

                        let metadata = entry.metadata().ok();

                        let size = metadata
                            .as_ref()
                            .map(|m| m.len())
                            .unwrap_or(0);

                        let last_modified = metadata
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| {
                                t.duration_since(std::time::UNIX_EPOCH).ok()
                            })
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);

                        pdf_files.push(ScannedPdfFile {
                            name,
                            path: file_path.to_string_lossy().to_string(),
                            size,
                            last_modified,
                            extension: "pdf".to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(pdf_files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_cli_launch_file,
            read_pdf_file_binary,
            scan_pdf_directory
        ])
        .setup(|app| {
            // Check if application was launched with a PDF argument and emit event to window
            if let Some(pdf_arg) = get_cli_launch_file() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("open-pdf-file", pdf_arg);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PaperLite application");
}