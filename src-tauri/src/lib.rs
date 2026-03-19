mod commands;
pub mod db;
pub mod hf;
pub mod state;
pub mod upload;

use state::AppState;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
use tauri_specta::{collect_commands, Builder};

pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::auth::validate_token,
        commands::auth::logout,
        commands::auth::get_stored_token,
        commands::auth::check_existing_token,
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
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
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
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
