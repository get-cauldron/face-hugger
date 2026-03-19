mod commands;
pub mod db;
pub mod hf;
pub mod state;
pub mod tray;
pub mod upload;

use state::AppState;
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;
use tauri_specta::{collect_commands, Builder};

pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::auth::validate_token,
        commands::auth::logout,
        commands::auth::get_stored_token,
        commands::auth::check_existing_token,
        commands::auth::oauth_start,
        commands::auth::oauth_exchange_code,
        commands::auth::oauth_cancel,
        commands::upload::enqueue_upload,
        commands::upload::cancel_upload,
        commands::upload::pause_upload,
        commands::upload::resume_upload,
        commands::upload::pause_all_uploads,
        commands::upload::list_uploads,
        commands::upload::set_upload_priority,
        commands::upload::start_upload_monitoring,
        commands::upload::set_concurrent_limit,
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            // Listen for tray "Pause All" menu event and trigger pause_all_uploads.
            // The tray menu event handler emits this event; we handle it in Rust so
            // pausing works even when the main window is hidden.
            let app_for_pause = app.handle().clone();
            app.listen("tray-pause-all", move |_event| {
                let app_clone = app_for_pause.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app_clone.try_state::<AppState>() {
                        let _ = upload::cancel::pause_all(&state.cancel_tokens, &state.db).await;
                    }
                });
            });

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let app_data_dir = app_handle.path().app_data_dir().expect("no app data dir");
                std::fs::create_dir_all(&app_data_dir).ok();
                let pool = db::init_db(&app_data_dir).await.expect("failed to init upload db");

                // Read persisted concurrent upload limit from tauri-plugin-store.
                // Default: 2 (per CONTEXT.md decision).
                let concurrent_limit: usize = app_handle
                    .store("preferences.json")
                    .ok()
                    .and_then(|s| s.get("concurrent_upload_limit"))
                    .and_then(|v| v.as_u64())
                    .map(|n| n as usize)
                    .unwrap_or(2);

                app_handle.manage(AppState::new(pool, concurrent_limit));

                // Setup system tray (must run after AppState is managed)
                crate::tray::setup_tray(&app_handle)
                    .expect("failed to setup tray");
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                // code == None means the window close button was clicked
                // (not a process-level kill signal).
                if code.is_none() && check_active_uploads(app_handle) {
                    // Uploads are in progress — hide the window and stay alive.
                    api.prevent_exit();
                    if let Some(w) = app_handle.get_webview_window("main") {
                        let _ = w.hide();
                    }
                }
                // No active uploads: allow the natural exit.
            }
        });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Returns true if any upload is currently transferring bytes (hashing, uploading, committing).
/// Used by RunEvent::ExitRequested to decide whether to hide-to-tray or quit.
fn check_active_uploads(app_handle: &AppHandle) -> bool {
    // AppState may not be managed yet if the app is closed before setup completes.
    let state = match app_handle.try_state::<AppState>() {
        Some(s) => s,
        None => return false,
    };
    let progress = state.progress_map.lock().unwrap();
    progress.values().any(|p| p.state.is_active())
}
