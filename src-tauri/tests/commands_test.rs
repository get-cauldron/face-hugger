// Integration tests for Rust command helpers — uses tauri::test feature.
//
// Commands with `AppHandle` in their signature (validate_token, start_upload, etc.)
// cannot be directly tested with MockRuntime due to tauri-specta trait bound issues
// (documented in RESEARCH.md Pitfall 6). Their pure logic helpers are tested instead.
// The existing auth_test.rs covers auth integration.

#[cfg(test)]
mod tests {
    // ---------------------------------------------------------------------------
    // Task: Validate tauri test feature is correctly enabled
    // ---------------------------------------------------------------------------

    /// Verify that the tauri `test` feature is enabled and mock_app() is callable.
    /// A non-panic result here means the feature is correctly configured in Cargo.toml.
    #[test]
    fn mock_app_creates_valid_app_handle() {
        let _app = tauri::test::mock_app();
        // Non-panic = tauri test feature is correctly enabled
    }

    // ---------------------------------------------------------------------------
    // Task: compute_xorb_ranges produces correct ranges
    // ---------------------------------------------------------------------------

    /// Verify xorb ranges are contiguous and cover the full file size.
    #[test]
    fn compute_xorb_ranges_produces_correct_ranges() {
        use face_hugger_lib::upload::worker::compute_xorb_ranges;

        let xorb_size = 64 * 1024 * 1024u64; // 64 MB

        // Test: file exactly one xorb
        let ranges = compute_xorb_ranges(xorb_size, xorb_size);
        assert_eq!(ranges.len(), 1);
        assert_eq!(ranges[0], (0, xorb_size));

        // Test: file slightly larger than one xorb (2 ranges)
        let total = xorb_size + 1024;
        let ranges = compute_xorb_ranges(total, xorb_size);
        assert_eq!(ranges.len(), 2);

        // Verify contiguity: each range starts where the previous one ended
        let mut expected_offset = 0u64;
        let mut covered = 0u64;
        for (offset, length) in &ranges {
            assert_eq!(*offset, expected_offset, "Range should start at expected offset");
            expected_offset += length;
            covered += length;
        }
        // Verify full coverage
        assert_eq!(covered, total, "Ranges must cover the entire file");

        // Test: file with multiple xorbs (150 MB file, 64 MB xorbs → 3 ranges)
        let total_150mb = 150 * 1024 * 1024u64;
        let ranges = compute_xorb_ranges(total_150mb, xorb_size);
        assert_eq!(ranges.len(), 3);

        let mut covered = 0u64;
        for (_, length) in &ranges {
            covered += length;
        }
        assert_eq!(covered, total_150mb, "3 ranges must cover all 150 MB");

        // Test: empty file returns single (0, 0) range
        let ranges = compute_xorb_ranges(0, xorb_size);
        assert_eq!(ranges.len(), 1);
        assert_eq!(ranges[0], (0, 0));
    }

    // ---------------------------------------------------------------------------
    // Task: parse_protocol detects xet vs lfs
    // ---------------------------------------------------------------------------

    /// Verify parse_protocol correctly identifies Xet and LFS responses.
    #[test]
    fn parse_protocol_detects_xet_vs_lfs() {
        use face_hugger_lib::hf::api::{LfsBatchResponse, parse_protocol};
        use face_hugger_lib::upload::types::UploadProtocol;

        // Xet case: transfer field is "xet"
        let xet_resp = LfsBatchResponse {
            transfer: "xet".to_string(),
            objects: vec![],
        };
        assert_eq!(
            parse_protocol(&xet_resp),
            UploadProtocol::Xet,
            "transfer='xet' should return UploadProtocol::Xet"
        );

        // LFS case: transfer field is anything else (e.g., "multipart")
        let lfs_resp = LfsBatchResponse {
            transfer: "multipart".to_string(),
            objects: vec![],
        };
        assert_eq!(
            parse_protocol(&lfs_resp),
            UploadProtocol::LfsMultipart,
            "transfer='multipart' should return UploadProtocol::LfsMultipart"
        );

        // LFS case: transfer field is "basic" (legacy fallback)
        let basic_resp = LfsBatchResponse {
            transfer: "basic".to_string(),
            objects: vec![],
        };
        assert_eq!(
            parse_protocol(&basic_resp),
            UploadProtocol::LfsMultipart,
            "transfer='basic' should fall back to UploadProtocol::LfsMultipart"
        );
    }

    // ---------------------------------------------------------------------------
    // Task: format_commit_body produces valid JSON
    // ---------------------------------------------------------------------------

    /// Verify format_commit_body output is valid ndjson with required fields.
    #[test]
    fn format_commit_body_produces_valid_ndjson() {
        use face_hugger_lib::hf::api::format_commit_body;

        let body = format_commit_body(
            "Upload model.safetensors",
            "model.safetensors",
            "abc123def456",
            1024 * 1024,
        );

        // Output must be two newline-delimited JSON lines (ndjson)
        let lines: Vec<&str> = body.lines().collect();
        assert_eq!(lines.len(), 2, "format_commit_body must produce exactly 2 JSON lines");

        // Line 1: header object
        let header: serde_json::Value = serde_json::from_str(lines[0])
            .expect("First line must be valid JSON");
        assert_eq!(header["key"], "header");
        assert_eq!(header["value"]["summary"], "Upload model.safetensors");

        // Line 2: lfsFile object
        let lfs_file: serde_json::Value = serde_json::from_str(lines[1])
            .expect("Second line must be valid JSON");
        assert_eq!(lfs_file["key"], "lfsFile");
        assert_eq!(lfs_file["value"]["path"], "model.safetensors");
        assert_eq!(lfs_file["value"]["algo"], "sha256");
        assert_eq!(lfs_file["value"]["oid"], "abc123def456");
        assert_eq!(lfs_file["value"]["size"], 1024 * 1024);
    }
}
