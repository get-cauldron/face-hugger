// Integration tests for tauri::test mock runtime.
//
// This binary links tauri — on Windows CI the WebView2Loader.dll entry point
// is unavailable in headless runners, so this file is excluded on Windows
// via Cargo.toml [[test]] harness configuration below the pure helper tests.
//
// Pure helper tests live in helpers_test.rs (no tauri dependency, runs everywhere).

#[cfg(test)]
mod tests {
    /// Verify that the tauri `test` feature is enabled and mock_app() is callable.
    #[test]
    fn mock_app_creates_valid_app_handle() {
        let _app = tauri::test::mock_app();
    }
}
