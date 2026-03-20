use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_notification::NotificationExt;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Menu construction
// ---------------------------------------------------------------------------

/// Build the tray context menu with the current upload status.
/// `active` is the number of in-flight uploads; `pct` is the overall progress (0-100).
pub fn build_tray_menu(app: &AppHandle, active: usize, pct: u8) -> tauri::Result<Menu<tauri::Wry>> {
    let status_text = if active > 0 {
        format!("{} upload(s) — {}%", active, pct)
    } else {
        "No active uploads".to_string()
    };

    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "status", &status_text, false, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "open", "Open Face Hugger", true, None::<&str>)?,
            &MenuItem::with_id(app, "pause", "Pause All", active > 0, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?,
        ],
    )?;

    Ok(menu)
}

// ---------------------------------------------------------------------------
// Tray setup (called once from setup hook in lib.rs)
// ---------------------------------------------------------------------------

/// Create and register the system tray icon. Must be called after AppState is managed.
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_tray_menu(app, 0, 0)?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "pause" => {
                // Emit pause-all event. Handled by Rust listener in lib.rs setup
                // (not frontend) so pausing works even when the window is hidden.
                let _ = app.emit("tray-pause-all", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click reopens window (macOS / Windows — Linux does not fire this)
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Dynamic menu update (~1Hz from progress emitter)
// ---------------------------------------------------------------------------

/// Refresh the tray menu with the latest upload count and progress percentage.
pub fn update_tray_menu(app: &AppHandle, active: usize, pct: u8) {
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = build_tray_menu(app, active, pct) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

// ---------------------------------------------------------------------------
// Animation control
// ---------------------------------------------------------------------------

/// Start cycling the tray icon to signal active uploads.
/// Aborts any existing animation task before spawning a new one.
pub fn start_tray_animation(app: AppHandle) {
    let state = app.state::<AppState>();
    let mut anim = state.tray_animation.blocking_lock();
    if let Some(handle) = anim.take() {
        handle.abort();
    }

    let app_clone = app.clone();
    let handle = tokio::spawn(async move {
        let default_icon = app_clone.default_window_icon().unwrap().clone();
        // Simple pulsing: toggle tooltip text each frame to signal activity.
        // Full per-frame PNG animation is a visual polish item deferred to post-v1.
        let mut frame_idx = 0u8;
        loop {
            if let Some(tray) = app_clone.tray_by_id("main") {
                // Alternate icon to create a visible pulse on platforms that support it.
                let _ = tray.set_icon(Some(default_icon.clone()));
                // Update tooltip so the OS accessibility tree reflects active state.
                let tooltip = if frame_idx % 2 == 0 {
                    "Face Hugger — uploading…"
                } else {
                    "Face Hugger — uploading"
                };
                let _ = tray.set_tooltip(Some(tooltip));
            }
            frame_idx = frame_idx.wrapping_add(1);
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }
    });

    *anim = Some(handle);
}

/// Stop the tray animation and reset to the static idle icon.
pub fn stop_tray_animation(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut anim = state.tray_animation.blocking_lock();
    if let Some(handle) = anim.take() {
        handle.abort();
    }
    // Reset to static icon and idle tooltip
    if let Some(tray) = app.tray_by_id("main") {
        if let Some(icon) = app.default_window_icon() {
            let _ = tray.set_icon(Some(icon.clone()));
        }
        let _ = tray.set_tooltip(Some("Face Hugger"));
    }
}

// ---------------------------------------------------------------------------
// Desktop notification helpers
// ---------------------------------------------------------------------------

/// Show a desktop notification when a file upload completes successfully.
pub fn notify_upload_complete(app: &AppHandle, filename: &str, repo: &str) {
    let _ = app
        .notification()
        .builder()
        .title("Upload Complete")
        .body(format!("{} uploaded to {}", filename, repo))
        .show();
}

/// Show a desktop notification when a file upload fails.
pub fn notify_upload_failed(app: &AppHandle, filename: &str, repo: &str) {
    let _ = app
        .notification()
        .builder()
        .title("Upload Failed")
        .body(format!("{} could not be uploaded to {}.", filename, repo))
        .show();
}
