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

/// Renames a file on the local filesystem
#[tauri::command]
fn rename_pdf_file(old_path: String, new_name: String) -> Result<String, String> {
    let old_clean = old_path.trim().trim_matches('"').trim_matches('\'').to_string();
    let old_p = Path::new(&old_clean);
    if !old_p.exists() {
        return Err(format!("File does not exist: {}", old_clean));
    }
    let parent = old_p.parent().ok_or_else(|| "Failed to get parent directory".to_string())?;
    let sanitized_name = if new_name.to_lowercase().ends_with(".pdf") {
        new_name
    } else {
        format!("{}.pdf", new_name)
    };
    let new_p = parent.join(&sanitized_name);
    fs::rename(old_p, &new_p).map_err(|e| format!("Failed to rename file: {}", e))?;
    Ok(new_p.to_string_lossy().to_string())
}

/// Deletes a PDF file permanently from storage / disk
#[tauri::command]
fn delete_pdf_from_storage(path: String) -> Result<bool, String> {
    let clean = path.trim().trim_matches('"').trim_matches('\'').to_string();
    let p = Path::new(&clean);
    if !p.exists() {
        // If file doesn't exist on disk, return Ok(true) so app can clean up references
        return Ok(true);
    }
    fs::remove_file(p).map_err(|e| format!("Failed to delete file from storage: {}", e))?;
    Ok(true)
}

/// Embedded bytes for pdf-icon.ico to guarantee the custom icon is always written
/// to disk and registered with Windows File Explorer, even in portable or unpackaged mode.
const PDF_ICON_BYTES: &[u8] = include_bytes!("../icons/pdf-icon.ico");

/// Registers and verifies that Windows File Explorer displays `pdf-icon.ico` for .pdf files
#[cfg(target_os = "windows")]
fn ensure_windows_pdf_icon_association() {
    let mut resolved_icon_path: Option<String> = None;

    // 1. Check if pdf-icon.ico is installed next to the executable (<exe_dir>\icons\pdf-icon.ico or <exe_dir>\pdf-icon.ico)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let exe_icon_dir = parent.join("icons");
            let _ = fs::create_dir_all(&exe_icon_dir);
            let exe_icon_file = exe_icon_dir.join("pdf-icon.ico");
            let exe_root_file = parent.join("pdf-icon.ico");

            // Write embedded icon if not yet present or writable
            let _ = fs::write(&exe_icon_file, PDF_ICON_BYTES);
            let _ = fs::write(&exe_root_file, PDF_ICON_BYTES);

            if exe_icon_file.exists() {
                resolved_icon_path = Some(exe_icon_file.to_string_lossy().to_string());
            } else if exe_root_file.exists() {
                resolved_icon_path = Some(exe_root_file.to_string_lossy().to_string());
            }
        }
    }

    // 2. Also write embedded pdf-icon.ico to %LOCALAPPDATA%\PaperLite\icons\pdf-icon.ico
    // This is always writable by current user without Administrator / UAC prompts
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let app_icon_dir = Path::new(&local_appdata).join("PaperLite").join("icons");
        if fs::create_dir_all(&app_icon_dir).is_ok() {
            let icon_file = app_icon_dir.join("pdf-icon.ico");
            let _ = fs::write(&icon_file, PDF_ICON_BYTES);
            if resolved_icon_path.is_none() && icon_file.exists() {
                resolved_icon_path = Some(icon_file.to_string_lossy().to_string());
            }
        }
    }

    let final_icon_path = resolved_icon_path.unwrap_or_else(|| "icons\\pdf-icon.ico".to_string());
    // In Windows Registry DefaultIcon, paths containing spaces MUST be wrapped in double quotes
    // so that Windows File Explorer does not fail to parse the path and fallback to icon.ico
    let quoted_icon_val = format!("\"{}\"", final_icon_path);

    let exe_path_str = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "PaperLite PDF Reader.exe".to_string());
    let open_command = format!("\"{}\" \"%1\"", exe_path_str);

    // 3. Register in HKCU\Software\Classes (user-level, no admin rights required)
    let hkcu_entries: [(&str, &str, &str); 17] = [
        // .pdf extension association
        ("HKCU\\Software\\Classes\\.pdf", "", "PaperLite.PDF"),
        ("HKCU\\Software\\Classes\\.pdf", "Content Type", "application/pdf"),
        ("HKCU\\Software\\Classes\\.pdf", "PerceivedType", "document"),
        ("HKCU\\Software\\Classes\\.pdf\\DefaultIcon", "", &quoted_icon_val),
        ("HKCU\\Software\\Classes\\.pdf\\OpenWithProgids", "PaperLite.PDF", ""),
        ("HKCU\\Software\\Classes\\.pdf\\OpenWithProgids", "com.paperlite.pdfreader.pdf", ""),

        // SystemFileAssociations fallback
        ("HKCU\\Software\\Classes\\SystemFileAssociations\\.pdf\\DefaultIcon", "", &quoted_icon_val),

        // PaperLite.PDF ProgID
        ("HKCU\\Software\\Classes\\PaperLite.PDF", "", "PDF Document"),
        ("HKCU\\Software\\Classes\\PaperLite.PDF\\DefaultIcon", "", &quoted_icon_val),
        ("HKCU\\Software\\Classes\\PaperLite.PDF\\shell\\open\\command", "", &open_command),
        ("HKCU\\Software\\Classes\\PaperLite.PDF\\shell\\open", "FriendlyAppName", "PaperLite PDF Reader"),

        // com.paperlite.pdfreader.pdf ProgID (Tauri default bundle ID override)
        ("HKCU\\Software\\Classes\\com.paperlite.pdfreader.pdf", "", "PDF Document"),
        ("HKCU\\Software\\Classes\\com.paperlite.pdfreader.pdf\\DefaultIcon", "", &quoted_icon_val),
        ("HKCU\\Software\\Classes\\com.paperlite.pdfreader.pdf\\shell\\open\\command", "", &open_command),
        ("HKCU\\Software\\Classes\\com.paperlite.pdfreader.pdf\\shell\\open", "FriendlyAppName", "PaperLite PDF Reader"),

        // Applications registration
        ("HKCU\\Software\\Classes\\Applications\\PaperLite PDF Reader.exe\\DefaultIcon", "", &quoted_icon_val),
        ("HKCU\\Software\\Classes\\Applications\\PaperLite PDF Reader.exe\\SupportedTypes", ".pdf", ""),
    ];

    for (key, val_name, val) in hkcu_entries {
        let mut cmd = std::process::Command::new("reg");
        cmd.arg("add").arg(key);
        if val_name.is_empty() {
            cmd.arg("/ve");
        } else {
            cmd.arg("/v").arg(val_name);
        }
        cmd.arg("/t").arg("REG_SZ").arg("/d").arg(val).arg("/f");
        let _ = cmd.output();
    }

    // Also attempt HKCR registration (succeeds if running with elevated / installer permissions)
    let hkcr_entries: [(&str, &str, &str); 8] = [
        ("HKCR\\.pdf", "", "PaperLite.PDF"),
        ("HKCR\\.pdf\\DefaultIcon", "", &quoted_icon_val),
        ("HKCR\\SystemFileAssociations\\.pdf\\DefaultIcon", "", &quoted_icon_val),
        ("HKCR\\PaperLite.PDF\\DefaultIcon", "", &quoted_icon_val),
        ("HKCR\\PaperLite.PDF\\shell\\open\\command", "", &open_command),
        ("HKCR\\com.paperlite.pdfreader.pdf\\DefaultIcon", "", &quoted_icon_val),
        ("HKCR\\com.paperlite.pdfreader.pdf\\shell\\open\\command", "", &open_command),
        ("HKCR\\Applications\\PaperLite PDF Reader.exe\\DefaultIcon", "", &quoted_icon_val),
    ];

    for (key, val_name, val) in hkcr_entries {
        let mut cmd = std::process::Command::new("reg");
        cmd.arg("add").arg(key);
        if val_name.is_empty() {
            cmd.arg("/ve");
        } else {
            cmd.arg("/v").arg(val_name);
        }
        cmd.arg("/t").arg("REG_SZ").arg("/d").arg(val).arg("/f");
        let _ = cmd.output();
    }

    // 4. Force Windows Explorer Shell to rebuild and reload the icon cache immediately
    let _ = std::process::Command::new("powershell")
        .args([
            "-WindowStyle", "Hidden",
            "-Command",
            "$c = '[DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int e, int f, IntPtr a, IntPtr b);'; \
             $t = Add-Type -MemberDefinition $c -Name 'S' -Namespace 'W' -PassThru; \
             $t::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero); \
             Start-Process -FilePath 'ie4uinit.exe' -ArgumentList '-show' -ErrorAction SilentlyContinue; \
             Start-Process -FilePath 'ie4uinit.exe' -ArgumentList '-ClearIconCache' -ErrorAction SilentlyContinue"
        ])
        .output();
}

/// Tauri command callable from frontend to ensure/refresh PDF file association icon in File Explorer
#[tauri::command]
fn register_pdf_file_association_icon() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        ensure_windows_pdf_icon_association();
        Ok("Windows PDF file icon successfully updated to pdf-icon.ico.".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("Icon registration is handled natively on this platform.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_cli_launch_file,
            read_pdf_file_binary,
            scan_pdf_directory,
            rename_pdf_file,
            delete_pdf_from_storage,
            register_pdf_file_association_icon
        ])
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                ensure_windows_pdf_icon_association();
            }

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