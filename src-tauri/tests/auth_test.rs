// Wave 0 test stubs for AUTH-01, AUTH-02
// These tests verify the Rust auth backend behaves correctly.
// They will fail until the auth commands are implemented.

#[cfg(test)]
mod tests {
    // AUTH-01: Token validation against HF API
    #[tokio::test]
    async fn test_token_validation_calls_whoami_v2() {
        // Verify that validate_token calls /api/whoami-v2 (not v1)
        // and returns UserInfo on success.
        // This test will be fleshed out once hf::client is created.
        panic!("WAVE 0 STUB: implement token validation test");
    }

    // AUTH-02: Keyring storage
    #[tokio::test]
    async fn test_keyring_store_and_retrieve() {
        // Verify that after validate_token succeeds, the token
        // can be retrieved from keyring via get_stored_token.
        panic!("WAVE 0 STUB: implement keyring store test");
    }

    // AUTH-02: Logout clears keyring
    #[tokio::test]
    async fn test_logout_clears_keyring() {
        // Verify that logout removes the token from keyring.
        panic!("WAVE 0 STUB: implement logout keyring test");
    }

    // AUTH-01: Check existing token from filesystem
    #[tokio::test]
    async fn test_check_existing_token_reads_filesystem() {
        // Verify check_existing_token reads ~/.cache/huggingface/token
        // and ~/.huggingface/token as fallbacks.
        panic!("WAVE 0 STUB: implement filesystem token check test");
    }
}
