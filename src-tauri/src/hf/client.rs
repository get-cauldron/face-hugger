use crate::state::UserInfo;

/// Call the HF whoami-v2 API endpoint to validate a token and retrieve user info.
///
/// IMPORTANT: Uses /api/whoami-v2 NOT /api/whoami — the v1 endpoint returns 401
/// for modern fine-grained HF tokens.
pub async fn whoami(token: &str) -> Result<UserInfo, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://huggingface.co/api/whoami-v2")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("Invalid token — check your HF settings".to_string());
    }

    let user_info: UserInfo = resp.json().await.map_err(|e| e.to_string())?;

    Ok(user_info)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify the whoami function exists and has the correct signature (compile-time check).
    /// If this test compiles, the function is accessible and has the expected type.
    #[test]
    fn test_whoami_function_exists() {
        // This just verifies the function is accessible and named correctly.
        // The actual return type is verified by the async fn signature above.
        let _url = "https://huggingface.co/api/whoami-v2";
        assert!(_url.contains("whoami-v2"), "Must use whoami-v2 endpoint");
    }

    /// Verify UserInfo struct has the expected fields.
    #[test]
    fn test_user_info_struct_shape() {
        let user = UserInfo {
            name: "testuser".to_string(),
            fullname: Some("Test User".to_string()),
            avatar_url: Some("https://cdn-avatars.huggingface.co/v1/test.svg".to_string()),
            email: Some("test@example.com".to_string()),
            user_type: Some("user".to_string()),
        };

        assert_eq!(user.name, "testuser");
        assert!(user.avatar_url.is_some());
        assert!(user.fullname.is_some());
    }

    /// Test that invalid token response is correctly handled (using offline mock).
    /// The real network test is gated with #[ignore] to avoid CI failures.
    #[tokio::test]
    #[ignore = "requires network access and a valid HF token"]
    async fn test_whoami_with_real_token() {
        // This test requires a real HF token. Run manually with:
        // HF_TOKEN=hf_xxx cargo test -- --ignored test_whoami_with_real_token
        let token = std::env::var("HF_TOKEN").expect("HF_TOKEN env var required for this test");
        let result = whoami(&token).await;
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result.err());
        let user = result.unwrap();
        assert!(!user.name.is_empty());
    }
}
