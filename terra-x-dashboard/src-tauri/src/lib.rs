// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // BUG FIX for Tauri Issue #5042: WebView2 permanently blocks camera if denied once.
    // We forcibly delete the Preferences file on boot so it forgets the block!
    #[cfg(target_os = "windows")]
    {
        if let Some(mut path) = dirs::data_local_dir() {
            path.push("com.meira.terra-x-dashboard");
            path.push("EBWebView");
            path.push("Default");
            path.push("Preferences");
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
