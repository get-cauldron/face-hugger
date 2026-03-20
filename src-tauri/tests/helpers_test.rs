// Pure helper function tests — no tauri dependency, runs on all platforms.

#[cfg(test)]
mod tests {
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

        let mut expected_offset = 0u64;
        let mut covered = 0u64;
        for (offset, length) in &ranges {
            assert_eq!(*offset, expected_offset, "Range should start at expected offset");
            expected_offset += length;
            covered += length;
        }
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

    /// Verify parse_protocol correctly identifies Xet and LFS responses.
    #[test]
    fn parse_protocol_detects_xet_vs_lfs() {
        use face_hugger_lib::hf::api::{LfsBatchResponse, parse_protocol};
        use face_hugger_lib::upload::types::UploadProtocol;

        let xet_resp = LfsBatchResponse {
            transfer: "xet".to_string(),
            objects: vec![],
        };
        assert_eq!(parse_protocol(&xet_resp), UploadProtocol::Xet);

        let lfs_resp = LfsBatchResponse {
            transfer: "multipart".to_string(),
            objects: vec![],
        };
        assert_eq!(parse_protocol(&lfs_resp), UploadProtocol::LfsMultipart);

        let basic_resp = LfsBatchResponse {
            transfer: "basic".to_string(),
            objects: vec![],
        };
        assert_eq!(parse_protocol(&basic_resp), UploadProtocol::LfsMultipart);
    }

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

        let lines: Vec<&str> = body.lines().collect();
        assert_eq!(lines.len(), 2, "format_commit_body must produce exactly 2 JSON lines");

        let header: serde_json::Value = serde_json::from_str(lines[0])
            .expect("First line must be valid JSON");
        assert_eq!(header["key"], "header");
        assert_eq!(header["value"]["summary"], "Upload model.safetensors");

        let lfs_file: serde_json::Value = serde_json::from_str(lines[1])
            .expect("Second line must be valid JSON");
        assert_eq!(lfs_file["key"], "lfsFile");
        assert_eq!(lfs_file["value"]["path"], "model.safetensors");
        assert_eq!(lfs_file["value"]["algo"], "sha256");
        assert_eq!(lfs_file["value"]["oid"], "abc123def456");
        assert_eq!(lfs_file["value"]["size"], 1024 * 1024);
    }
}
