// Integration tests for Rust command helpers.
//
// NOTE: This test binary links against tauri (for mock_app). On Windows CI,
// the WebView2 DLLs are not available in the headless runner, causing
// STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139) when the binary loads.
// Pure helper tests that don't need tauri are in their respective modules
// (e.g., worker::tests, api::tests) and run via `cargo test` without issue.

#[cfg(test)]
mod tests {
    // ---------------------------------------------------------------------------
    // Task: Validate tauri test feature is correctly enabled
    // ---------------------------------------------------------------------------

    /// Verify that the tauri `test` feature is enabled and mock_app() is callable.
    #[test]
    fn mock_app_creates_valid_app_handle() {
        let _app = tauri::test::mock_app();
        // Non-panic = tauri test feature is correctly enabled
    }
}
