use rayon::ThreadPoolBuilder;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::OnceLock;

static HASH_POOL: OnceLock<rayon::ThreadPool> = OnceLock::new();

fn hash_pool() -> &'static rayon::ThreadPool {
    HASH_POOL.get_or_init(|| {
        ThreadPoolBuilder::new()
            .num_threads(2) // cap at 2 per CONTEXT.md decision
            .thread_name(|i| format!("face-hugger-hasher-{}", i))
            .build()
            .expect("failed to build hash threadpool")
    })
}

/// Stream-hash a file using SHA-256, returning (hash_bytes, file_size).
/// Runs in the dedicated 2-thread rayon pool via spawn_blocking bridge.
pub async fn hash_file_streaming(path: &Path) -> Result<([u8; 32], u64), String> {
    let path = path.to_owned();

    tokio::task::spawn_blocking(move || {
        hash_pool().install(|| {
            use std::io::Read;

            let mut file = std::fs::File::open(&path).map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    format!("Source file not found: {}", path.display())
                } else {
                    format!("Failed to open file {}: {}", path.display(), e)
                }
            })?;

            let mut hasher = Sha256::new();
            let mut total_bytes: u64 = 0;
            // 8MB buffer
            let mut buf = vec![0u8; 8 * 1024 * 1024];

            loop {
                let n = file.read(&mut buf).map_err(|e| {
                    format!("Read error on {}: {}", path.display(), e)
                })?;
                if n == 0 {
                    break;
                }
                hasher.update(&buf[..n]);
                total_bytes += n as u64;
            }

            let hash: [u8; 32] = hasher.finalize().into();
            Ok((hash, total_bytes))
        })
    })
    .await
    .map_err(|e| format!("spawn_blocking panicked: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[tokio::test]
    async fn test_hash_known_content() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.bin");
        {
            let mut f = std::fs::File::create(&file_path).unwrap();
            f.write_all(b"hello world").unwrap();
        }
        let (hash, size) = hash_file_streaming(&file_path).await.unwrap();
        assert_eq!(size, 11);
        // SHA-256 of "hello world"
        let hex = hex::encode(hash);
        assert_eq!(hex, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    }

    #[tokio::test]
    async fn test_hash_empty_file() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("empty.bin");
        std::fs::File::create(&file_path).unwrap();
        let (hash, size) = hash_file_streaming(&file_path).await.unwrap();
        assert_eq!(size, 0);
        let hex = hex::encode(hash);
        // SHA-256 of empty string
        assert_eq!(hex, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    #[tokio::test]
    async fn test_hash_nonexistent_file() {
        let result = hash_file_streaming(Path::new("/nonexistent/file.bin")).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_hash_pool_is_2_threads() {
        let pool = hash_pool();
        assert_eq!(pool.current_num_threads(), 2);
    }
}
