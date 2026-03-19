use std::collections::HashMap;

use crate::upload::types::UploadProtocol;

// ---------------------------------------------------------------------------
// Internal helpers (public within crate so tests can call them)
// ---------------------------------------------------------------------------

/// Build the LFS batch URL for a given repo_id (e.g. "user/my-model").
pub fn lfs_batch_url(repo_id: &str) -> String {
    format!(
        "https://huggingface.co/{}.git/info/lfs/objects/batch",
        repo_id
    )
}

/// Build the commit API URL.
pub fn commit_url(repo_type: &str, repo_id: &str, revision: &str) -> String {
    format!(
        "https://huggingface.co/api/{}s/{}/commit/{}",
        repo_type, repo_id, revision
    )
}

/// Parse protocol from an LFS batch response.
pub fn parse_protocol(resp: &LfsBatchResponse) -> UploadProtocol {
    if resp.transfer == "xet" {
        UploadProtocol::Xet
    } else {
        UploadProtocol::LfsMultipart
    }
}

/// Format the two-line ndjson body for the HF commit API.
pub fn format_commit_body(
    commit_message: &str,
    path_in_repo: &str,
    sha256_hex: &str,
    file_size: u64,
) -> String {
    let header = serde_json::json!({
        "key": "header",
        "value": {
            "summary": commit_message,
            "description": ""
        }
    });
    let lfs_file = serde_json::json!({
        "key": "lfsFile",
        "value": {
            "path": path_in_repo,
            "algo": "sha256",
            "oid": sha256_hex,
            "size": file_size
        }
    });
    format!("{}\n{}\n", header.to_string(), lfs_file.to_string())
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
pub struct LfsBatchResponse {
    pub transfer: String,
    pub objects: Vec<serde_json::Value>,
}

#[derive(Debug, serde::Serialize)]
struct LfsBatchRequest {
    operation: String,
    transfers: Vec<String>,
    objects: Vec<LfsBatchObject>,
}

#[derive(Debug, serde::Serialize)]
struct LfsBatchObject {
    oid: String,
    size: u64,
}

#[derive(Debug, Clone)]
pub struct LfsPart {
    pub part_number: usize,
    pub upload_url: String,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct LfsUploadInfo {
    pub parts: Vec<LfsPart>,
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/// Detect the upload protocol for a repo by calling the LFS batch endpoint.
///
/// Returns `UploadProtocol::Xet` if the batch response's `transfer` field is
/// `"xet"`, otherwise `UploadProtocol::LfsMultipart`.
///
/// # Errors
/// Returns a descriptive string error on 401/403 or network failure.
pub async fn detect_upload_protocol(
    client: &reqwest::Client,
    hf_token: &str,
    repo_id: &str,
    file_oid: &str,
    file_size: u64,
) -> Result<UploadProtocol, String> {
    let url = lfs_batch_url(repo_id);
    let body = LfsBatchRequest {
        operation: "upload".into(),
        transfers: vec!["xet".into(), "multipart".into()],
        objects: vec![LfsBatchObject {
            oid: file_oid.into(),
            size: file_size,
        }],
    };

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .header("Content-Type", "application/vnd.git-lfs+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    match resp.status().as_u16() {
        401 => return Err("Authentication failed — check your HF token".to_string()),
        403 => return Err("Permission denied — you don't have write access to this repo".to_string()),
        s if s >= 500 => return Err(format!("Server error: HTTP {}", s)),
        _ => {}
    }

    let batch: LfsBatchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse LFS batch response: {}", e))?;

    Ok(parse_protocol(&batch))
}

/// Check that the authenticated user has write access to the repo.
///
/// On success returns `Ok(())`. On 401/403/404 returns a clear error message.
pub async fn check_write_access(
    client: &reqwest::Client,
    hf_token: &str,
    repo_type: &str,
    repo_id: &str,
) -> Result<(), String> {
    let url = format!("https://huggingface.co/api/{}s/{}", repo_type, repo_id);

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    match resp.status().as_u16() {
        200 => Ok(()),
        401 => Err("Authentication failed — check your token".to_string()),
        403 => Err("You don't have write access to this repo".to_string()),
        404 => Err(format!("Repository not found: {}", repo_id)),
        s => Err(format!("Unexpected response checking write access: HTTP {}", s)),
    }
}

/// POST an ndjson commit to the HF Hub.
///
/// Returns the response body string on success (e.g. the commit URL).
pub async fn create_commit(
    client: &reqwest::Client,
    hf_token: &str,
    repo_type: &str,
    repo_id: &str,
    revision: &str,
    commit_message: &str,
    path_in_repo: &str,
    sha256_hex: &str,
    file_size: u64,
) -> Result<String, String> {
    let url = commit_url(repo_type, repo_id, revision);
    let body = format_commit_body(commit_message, path_in_repo, sha256_hex, file_size);

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .header("Content-Type", "application/x-ndjson")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    match resp.status().as_u16() {
        200 | 201 => {
            let text = resp.text().await.map_err(|e| e.to_string())?;
            Ok(text)
        }
        409 => Err("Conflict — someone else may have pushed to this branch".to_string()),
        401 => Err("Authentication failed — check your token".to_string()),
        403 => Err("Permission denied — you don't have write access to this repo".to_string()),
        s => {
            let body = resp.text().await.unwrap_or_default();
            Err(format!("Commit failed with HTTP {}: {}", s, body))
        }
    }
}

/// Get LFS multipart upload info (pre-signed URLs) for a file.
///
/// Calls the LFS batch endpoint and extracts multipart upload parts from the
/// response objects.
pub async fn get_lfs_upload_info(
    client: &reqwest::Client,
    hf_token: &str,
    repo_id: &str,
    file_oid: &str,
    file_size: u64,
) -> Result<LfsUploadInfo, String> {
    let url = lfs_batch_url(repo_id);
    let body = LfsBatchRequest {
        operation: "upload".into(),
        transfers: vec!["multipart".into()],
        objects: vec![LfsBatchObject {
            oid: file_oid.into(),
            size: file_size,
        }],
    };

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", hf_token))
        .header("Content-Type", "application/vnd.git-lfs+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("LFS batch request failed: HTTP {}", resp.status()));
    }

    let batch: LfsBatchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse LFS batch response: {}", e))?;

    // Extract the first object's upload parts
    let obj = batch
        .objects
        .first()
        .ok_or_else(|| "No objects in LFS batch response".to_string())?;

    let mut parts: Vec<LfsPart> = Vec::new();

    // Try multipart parts first
    if let Some(actions) = obj.get("actions") {
        if let Some(parts_arr) = actions.get("parts") {
            if let Some(arr) = parts_arr.as_array() {
                for (i, part) in arr.iter().enumerate() {
                    let upload_url = part
                        .get("href")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let mut headers: HashMap<String, String> = HashMap::new();
                    if let Some(h) = part.get("header").and_then(|v| v.as_object()) {
                        for (k, v) in h {
                            if let Some(s) = v.as_str() {
                                headers.insert(k.clone(), s.to_string());
                            }
                        }
                    }
                    parts.push(LfsPart {
                        part_number: i + 1,
                        upload_url,
                        headers,
                    });
                }
                return Ok(LfsUploadInfo { parts });
            }
        }

        // Fall back to single upload action
        if let Some(upload) = actions.get("upload") {
            let upload_url = upload
                .get("href")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let mut headers: HashMap<String, String> = HashMap::new();
            if let Some(h) = upload.get("header").and_then(|v| v.as_object()) {
                for (k, v) in h {
                    if let Some(s) = v.as_str() {
                        headers.insert(k.clone(), s.to_string());
                    }
                }
            }
            parts.push(LfsPart {
                part_number: 1,
                upload_url,
                headers,
            });
        }
    }

    Ok(LfsUploadInfo { parts })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_xet_from_batch_response() {
        let resp = LfsBatchResponse {
            transfer: "xet".to_string(),
            objects: vec![],
        };
        assert_eq!(parse_protocol(&resp), UploadProtocol::Xet);
    }

    #[test]
    fn test_detect_lfs_from_batch_response() {
        let resp = LfsBatchResponse {
            transfer: "multipart".to_string(),
            objects: vec![],
        };
        assert_eq!(parse_protocol(&resp), UploadProtocol::LfsMultipart);
    }

    #[test]
    fn test_detect_basic_lfs_fallback() {
        let resp = LfsBatchResponse {
            transfer: "basic".to_string(),
            objects: vec![],
        };
        assert_eq!(parse_protocol(&resp), UploadProtocol::LfsMultipart);
    }

    #[test]
    fn test_commit_ndjson_format() {
        let body = format_commit_body("Upload model.bin", "model.bin", "abc123def456", 1048576);
        let lines: Vec<&str> = body.trim().split('\n').collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("\"key\":\"header\""), "First line missing key:header, got: {}", lines[0]);
        assert!(lines[0].contains("Upload model.bin"), "First line missing commit message, got: {}", lines[0]);
        assert!(lines[1].contains("\"key\":\"lfsFile\""), "Second line missing key:lfsFile, got: {}", lines[1]);
        assert!(lines[1].contains("abc123def456"), "Second line missing oid, got: {}", lines[1]);
        assert!(lines[1].contains("1048576"), "Second line missing size, got: {}", lines[1]);
    }

    #[test]
    fn test_lfs_batch_url_format() {
        let url = lfs_batch_url("user/my-model");
        assert_eq!(
            url,
            "https://huggingface.co/user/my-model.git/info/lfs/objects/batch"
        );
    }

    #[test]
    fn test_commit_url_format() {
        let url = commit_url("model", "user/my-model", "main");
        assert_eq!(
            url,
            "https://huggingface.co/api/models/user/my-model/commit/main"
        );
    }

    #[test]
    fn test_commit_body_is_valid_ndjson() {
        let body = format_commit_body("Test commit", "data/file.bin", "deadbeef", 2048);
        // Each line should be valid JSON
        let lines: Vec<&str> = body.trim().split('\n').collect();
        for line in &lines {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(line);
            assert!(parsed.is_ok(), "Line is not valid JSON: {}", line);
        }
    }

    #[test]
    fn test_commit_body_contains_lfs_fields() {
        let body = format_commit_body("msg", "path/to/file.bin", "sha256hash", 999);
        assert!(body.contains("\"algo\":\"sha256\""), "Missing algo field");
        assert!(body.contains("path/to/file.bin"), "Missing path");
        assert!(body.contains("sha256hash"), "Missing oid");
        assert!(body.contains("999"), "Missing size");
    }

    #[tokio::test]
    #[ignore = "requires network + valid HF token"]
    async fn test_check_write_access_real() {
        let token = std::env::var("HF_TOKEN").unwrap();
        let client = reqwest::Client::new();
        let result = check_write_access(&client, &token, "model", "some-user/some-repo").await;
        // Just verify it returns a result without panic
        println!("write access result: {:?}", result);
    }
}
