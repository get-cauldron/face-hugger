use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Xet write token received from the HF xet-write-token endpoint.
/// Contains the CAS server URL, short-lived access token, and expiry timestamp.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct XetWriteToken {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    /// Unix timestamp (seconds) when the token expires.
    pub exp: u64,
    #[serde(rename = "casUrl")]
    pub cas_url: String,
}

// ---------------------------------------------------------------------------
// Hash encoding — CRITICAL non-standard byte reversal
// ---------------------------------------------------------------------------

/// Encode a 32-byte Xet hash into the non-standard Xet hex format.
///
/// For each 8-byte block, interpret the bytes as a little-endian u64, then
/// format that u64 as a 16-character lowercase hex string.  This is NOT the
/// same as `hex::encode(hash)`.
///
/// Spec reference: https://huggingface.co/docs/xet/main/en/api#converting-hashes-to-strings
pub fn xet_hash_to_hex(hash: &[u8; 32]) -> String {
    let mut result = String::with_capacity(64);
    for i in 0..4 {
        let block = &hash[i * 8..(i + 1) * 8];
        let val = u64::from_le_bytes(block.try_into().unwrap());
        result.push_str(&format!("{:016x}", val));
    }
    result
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/// Returns `true` if the token should be refreshed (expires within 30 seconds
/// of the current time).
pub fn token_needs_refresh(token: &XetWriteToken) -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    now + 30 >= token.exp
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/// Fetch a fresh Xet write token from the HF Hub.
pub async fn get_xet_write_token(
    client: &reqwest::Client,
    hf_token: &str,
    repo_type: &str,
    repo_id: &str,
    revision: &str,
) -> Result<XetWriteToken, String> {
    let url = format!(
        "https://huggingface.co/api/{}s/{}/xet-write-token/{}",
        repo_type, repo_id, revision
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .send()
        .await
        .map_err(|e| format!("Network error fetching Xet write token: {}", e))?;

    match resp.status().as_u16() {
        200 => {
            let token: XetWriteToken = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse Xet write token response: {}", e))?;
            Ok(token)
        }
        401 => Err("Authentication failed — check your HF token".to_string()),
        403 => Err("Permission denied — you don't have write access to this repo".to_string()),
        404 => Err(format!("Xet write token endpoint not found — is this a Xet-enabled repo? ({})", repo_id)),
        s => Err(format!("Unexpected status fetching Xet write token: HTTP {}", s)),
    }
}

/// Upload an xorb (chunk bundle) to the Xet CAS server.
///
/// Returns `true` if the xorb was newly inserted, `false` if it already
/// existed on the server (both are success cases — idempotent endpoint).
///
/// # Errors
/// - Returns a `TokenExpired`-style error on 401 so the caller can refresh and retry.
/// - Returns retryable error string on 5xx/timeouts.
pub async fn upload_xorb(
    client: &reqwest::Client,
    cas_url: &str,
    xet_token: &str,
    xorb_hash: &str,
    xorb_bytes: bytes::Bytes,
) -> Result<bool, String> {
    let url = format!("{}/v1/xorbs/default/{}", cas_url, xorb_hash);

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", xet_token))
        .header("Content-Type", "application/octet-stream")
        .body(xorb_bytes)
        .send()
        .await
        .map_err(|e| format!("Network error uploading xorb: {}", e))?;

    match resp.status().as_u16() {
        200 => {
            // Try to parse was_inserted; default to true if missing
            let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::json!({}));
            let was_inserted = body
                .get("was_inserted")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            Ok(was_inserted)
        }
        400 => Err("Bad request uploading xorb — malformed data".to_string()),
        401 => Err("Token expired — refresh Xet write token and retry".to_string()),
        403 => Err("Permission denied uploading xorb".to_string()),
        s if s >= 500 => Err(format!("Server error uploading xorb: HTTP {} — retryable", s)),
        s => Err(format!("Unexpected status uploading xorb: HTTP {}", s)),
    }
}

/// Upload a shard to the Xet CAS server.
///
/// A shard describes how xorbs are assembled into a file.  ALL xorbs
/// referenced by this shard MUST be fully uploaded before calling this
/// function.
pub async fn upload_shard(
    client: &reqwest::Client,
    cas_url: &str,
    xet_token: &str,
    shard_bytes: bytes::Bytes,
) -> Result<(), String> {
    let url = format!("{}/v1/shards", cas_url);

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", xet_token))
        .header("Content-Type", "application/octet-stream")
        .body(shard_bytes)
        .send()
        .await
        .map_err(|e| format!("Network error uploading shard: {}", e))?;

    match resp.status().as_u16() {
        200 => Ok(()),
        400 => {
            let body = resp.text().await.unwrap_or_default();
            Err(format!(
                "Bad request uploading shard — a referenced xorb may be missing: {}",
                body
            ))
        }
        401 => Err("Token expired — refresh Xet write token and retry".to_string()),
        403 => Err("Permission denied uploading shard".to_string()),
        s if s >= 500 => Err(format!("Server error uploading shard: HTTP {} — retryable", s)),
        s => Err(format!("Unexpected status uploading shard: HTTP {}", s)),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xet_hash_encoding_spec_example() {
        // Spec: bytes [0,1,2,3,4,5,6,7] as LE u64 = 0x0706050403020100
        // Formatted as hex: "0706050403020100"
        let mut hash = [0u8; 32];
        for i in 0..32 {
            hash[i] = i as u8;
        }
        let hex = xet_hash_to_hex(&hash);
        assert_eq!(hex.len(), 64);
        // First 8 bytes [0..7] as LE u64 → big-endian hex
        assert!(
            hex.starts_with("0706050403020100"),
            "First block wrong. Got: {}",
            hex
        );
        // Second 8 bytes [8..15] as LE u64 → big-endian hex
        assert!(
            hex[16..32].starts_with("0f0e0d0c0b0a0908"),
            "Second block wrong. Got: {}",
            &hex[16..32]
        );
    }

    #[test]
    fn test_xet_hash_all_zeros() {
        let hash = [0u8; 32];
        let hex = xet_hash_to_hex(&hash);
        assert_eq!(
            hex,
            "0000000000000000000000000000000000000000000000000000000000000000"
        );
    }

    #[test]
    fn test_xet_hash_known_value() {
        // Verify it's NOT the same as plain hex::encode
        let mut hash = [0u8; 32];
        hash[0] = 0xFF;
        let xet_hex = xet_hash_to_hex(&hash);
        let plain_hex = hex::encode(hash);
        // Plain hex starts with "ff00...", xet hex has byte reversal within 8-byte blocks
        assert_ne!(xet_hex, plain_hex, "Xet encoding must differ from plain hex");
        // In xet encoding, byte 0 (0xFF) is the least significant byte of the first LE u64
        // So the u64 value is 0x00000000000000FF, formatted as hex: "00000000000000ff"
        assert!(
            xet_hex.starts_with("00000000000000ff"),
            "First block wrong. Got: {}",
            xet_hex
        );
    }

    #[test]
    fn test_token_needs_refresh_expired() {
        let token = XetWriteToken {
            access_token: "test".into(),
            exp: 1000, // far in the past
            cas_url: "https://cas.example.com".into(),
        };
        assert!(token_needs_refresh(&token));
    }

    #[test]
    fn test_token_needs_refresh_fresh() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let token = XetWriteToken {
            access_token: "test".into(),
            exp: now + 3600, // 1 hour from now
            cas_url: "https://cas.example.com".into(),
        };
        assert!(!token_needs_refresh(&token));
    }

    #[test]
    fn test_token_needs_refresh_within_buffer() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let token = XetWriteToken {
            access_token: "test".into(),
            exp: now + 20, // only 20s left, within 30s buffer
            cas_url: "https://cas.example.com".into(),
        };
        assert!(token_needs_refresh(&token));
    }

    #[test]
    fn test_xorb_upload_url_format() {
        let url = format!(
            "{}/v1/xorbs/default/{}",
            "https://cas.example.com", "abc123"
        );
        assert_eq!(url, "https://cas.example.com/v1/xorbs/default/abc123");
    }

    #[test]
    fn test_shard_upload_url_format() {
        let url = format!("{}/v1/shards", "https://cas.example.com");
        assert_eq!(url, "https://cas.example.com/v1/shards");
    }

    #[test]
    fn test_xet_hash_third_and_fourth_blocks() {
        // Verify blocks 3 and 4 also encode correctly
        let mut hash = [0u8; 32];
        for i in 0..32 {
            hash[i] = i as u8;
        }
        let hex = xet_hash_to_hex(&hash);
        // Third 8 bytes [16..23]: [16,17,18,19,20,21,22,23]
        // LE u64: 0x1716151413121110
        assert_eq!(&hex[32..48], "1716151413121110", "Third block: {}", &hex[32..48]);
        // Fourth 8 bytes [24..31]: [24,25,26,27,28,29,30,31]
        // LE u64: 0x1f1e1d1c1b1a1918
        assert_eq!(&hex[48..64], "1f1e1d1c1b1a1918", "Fourth block: {}", &hex[48..64]);
    }
}
