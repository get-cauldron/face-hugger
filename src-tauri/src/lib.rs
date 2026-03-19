mod commands;
pub mod db;
pub mod hf;
pub mod state;
pub mod upload;

use state::AppState;
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::auth::validate_token,
        commands::auth::logout,
        commands::auth::get_stored_token,
        commands::auth::check_existing_token,
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
                app_handle.manage(AppState::new(pool));
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
