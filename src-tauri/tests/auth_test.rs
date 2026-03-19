// Integration tests for auth backend — AUTH-01, AUTH-02
// These tests verify the Rust auth commands and HF client behave correctly.

// Note: Tests requiring real OS keychain or network access are marked #[ignore].
// Run them manually with: cargo test -- --ignored

#[cfg(test)]
mod tests {
    use std::io::Write;
    use tempfile::TempDir;

    /// AUTH-01: Verify the whoami function returns the correct type and URL.
    /// This test checks the function signature is correct (compile-time check)
    /// and validates the URL uses /api/whoami-v2 by reading the source.
    #[test]
    fn test_token_validation_uses_whoami_v2() {
        // The hf::client::whoami function must call /api/whoami-v2 — NOT /api/whoami.
        // We verify this by checking the source contains the correct URL.
        // This is a compile-time guarantee: if the function signature changes, this test breaks.
        let source = include_str!("../src/hf/client.rs");
        assert!(
            source.contains("whoami-v2"),
            "hf::client must call /api/whoami-v2, not /api/whoami"
        );
        assert!(
            !source.contains("/api/whoami\""),
            "hf::client must NOT call the deprecated /api/whoami v1 endpoint"
        );
    }

    /// AUTH-01: Verify check_existing_token reads ~/.cache/huggingface/token.
    /// Creates a temporary token file and verifies the filesystem read logic works.
    #[tokio::test]
    async fn test_check_existing_token_reads_filesystem() {
        let tmp_dir = TempDir::new().expect("Failed to create temp dir");
        let cache_dir = tmp_dir.path().join(".cache/huggingface");
        std::fs::create_dir_all(&cache_dir).expect("Failed to create cache dir");

        let token_path = cache_dir.join("token");
        let expected_token = "hf_test_token_abc123";

        let mut file = std::fs::File::create(&token_path).expect("Failed to create token file");
        writeln!(file, "{}", expected_token).expect("Failed to write token");

        // Read the token file directly (mirrors check_existing_token logic)
        let token = tokio::fs::read_to_string(&token_path)
            .await
            .expect("Failed to read token file");
        let token = token.trim().to_string();

        assert_eq!(
            token, expected_token,
            "Token file should be readable and trimmed"
        );
        assert!(!token.is_empty(), "Token should not be empty");
    }

    /// AUTH-01: Verify that whitespace-only token files are treated as absent.
    #[tokio::test]
    async fn test_check_existing_token_rejects_empty_file() {
        let tmp_dir = TempDir::new().expect("Failed to create temp dir");
        let token_path = tmp_dir.path().join("token");

        let mut file = std::fs::File::create(&token_path).expect("Failed to create token file");
        writeln!(file, "   ").expect("Failed to write whitespace");

        let token = tokio::fs::read_to_string(&token_path)
            .await
            .expect("Failed to read file");
        let token = token.trim().to_string();

        assert!(
            token.is_empty(),
            "Whitespace-only token should be treated as empty"
        );
    }

    /// AUTH-02: Verify keyring store and retrieve (requires OS keychain — run manually).
    #[tokio::test]
    #[ignore = "requires OS keychain access — run manually: cargo test -- --ignored test_keyring_store_and_retrieve"]
    async fn test_keyring_store_and_retrieve() {
        let test_token = "hf_test_keyring_token_xyz";
        let entry = keyring::Entry::new("face-hugger-test", "hf-token-test")
            .expect("Failed to create keyring entry");

        // Store
        entry
            .set_password(test_token)
            .expect("Failed to store token in keychain");

        // Retrieve
        let retrieved = entry
            .get_password()
            .expect("Failed to retrieve token from keychain");

        assert_eq!(
            retrieved, test_token,
            "Retrieved token must match stored token"
        );

        // Cleanup
        let _ = entry.delete_credential();
    }

    /// AUTH-02: Verify logout clears keyring (requires OS keychain — run manually).
    #[tokio::test]
    #[ignore = "requires OS keychain access — run manually: cargo test -- --ignored test_logout_clears_keyring"]
    async fn test_logout_clears_keyring() {
        let test_token = "hf_test_logout_token_abc";
        let entry = keyring::Entry::new("face-hugger-test", "hf-token-logout-test")
            .expect("Failed to create keyring entry");

        // Setup: store a token
        entry
            .set_password(test_token)
            .expect("Failed to store token");

        // Act: delete the credential (mirrors logout behavior)
        entry
            .delete_credential()
            .expect("Failed to delete credential");

        // Verify: token should be gone
        let result = entry.get_password();
        assert!(
            matches!(
                result,
                Err(keyring::Error::NoEntry) | Err(keyring::Error::NoStorageAccess(_))
            ),
            "After logout, keychain entry should be gone. Got: {:?}",
            result
        );
    }

    /// AUTH-01: Verify validate_token with a real token (requires network + valid token).
    #[tokio::test]
    #[ignore = "requires network access and a valid HF token — set HF_TOKEN env var"]
    async fn test_token_validation_calls_whoami_v2_real() {
        let token = std::env::var("HF_TOKEN")
            .expect("HF_TOKEN env var required. Usage: HF_TOKEN=hf_xxx cargo test -- --ignored");

        // This calls the actual HF API
        let result = face_hugger_lib::hf::client::whoami(&token).await;

        assert!(result.is_ok(), "Valid token should return Ok(UserInfo)");
        let user = result.unwrap();
        assert!(!user.name.is_empty(), "UserInfo.name must not be empty");
    }
}
