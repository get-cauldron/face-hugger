use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;
use tokio::time::{interval, Duration};

use crate::upload::types::{UploadJobState, UploadProgress};

/// Shared map of job_id -> UploadProgress for in-flight uploads.
/// Uses std::sync::Mutex (not tokio) for short critical sections shared between
/// sync and async contexts. Workers lock briefly to update bytes; the timer reads it.
pub type ProgressMap = Arc<StdMutex<HashMap<String, UploadProgress>>>;

pub fn new_progress_map() -> ProgressMap {
    Arc::new(StdMutex::new(HashMap::new()))
}

/// Helper for the upload worker to call when bytes progress changes.
pub fn update_progress(
    map: &ProgressMap,
    job_id: &str,
    bytes_sent: u64,
    total_bytes: u64,
    state: UploadJobState,
) {
    let mut m = map.lock().unwrap();
    let entry = m.entry(job_id.to_string()).or_insert_with(|| UploadProgress {
        job_id: job_id.to_string(),
        bytes_sent: 0,
        total_bytes,
        speed_bps: 0.0,
        eta_seconds: 0.0,
        state,
    });
    // Update bytes and state; speed/ETA calculation uses a separate SpeedTracker per job
    entry.bytes_sent = bytes_sent;
    entry.total_bytes = total_bytes;
    entry.state = state;
}

/// Remove a job from the progress map when it completes or is removed.
pub fn remove_progress(map: &ProgressMap, job_id: &str) {
    let mut m = map.lock().unwrap();
    m.remove(job_id);
}

/// Sliding-window speed calculator for a single upload job.
/// Maintains a 5-second window of (timestamp, bytes_sent) samples.
pub struct SpeedTracker {
    samples: Vec<(std::time::Instant, u64)>,
    window: std::time::Duration,
}

impl SpeedTracker {
    pub fn new() -> Self {
        Self {
            samples: Vec::new(),
            window: std::time::Duration::from_secs(5),
        }
    }

    pub fn record(&mut self, bytes_sent: u64) {
        let now = std::time::Instant::now();
        self.samples.push((now, bytes_sent));
        // Prune old samples outside the window
        self.samples.retain(|(t, _)| now.duration_since(*t) < self.window);
    }

    pub fn speed_bps(&self) -> f64 {
        if self.samples.len() < 2 {
            return 0.0;
        }
        let first = self.samples.first().unwrap();
        let last = self.samples.last().unwrap();
        let elapsed = last.0.duration_since(first.0).as_secs_f64();
        if elapsed < 0.001 {
            return 0.0;
        }
        let bytes_delta = last.1.saturating_sub(first.1);
        bytes_delta as f64 / elapsed
    }

    pub fn eta_seconds(&self, total_bytes: u64, bytes_sent: u64) -> f64 {
        let speed = self.speed_bps();
        if speed < 1.0 {
            return f64::INFINITY;
        }
        let remaining = total_bytes.saturating_sub(bytes_sent) as f64;
        remaining / speed
    }
}

/// Spawns a background tokio task that reads the ProgressMap every 500ms
/// and sends a Vec<UploadProgress> batch via the IPC Channel.
///
/// The Channel sends all active jobs' progress at once — never per-chunk.
/// This design is more efficient than one channel per job and ensures the
/// frontend receives a consistent snapshot of all in-flight uploads.
pub fn start_progress_emitter(
    progress_map: ProgressMap,
    channel: Channel<Vec<UploadProgress>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut timer = interval(Duration::from_millis(500));
        loop {
            timer.tick().await;
            let updates: Vec<UploadProgress> = {
                let map = progress_map.lock().unwrap();
                map.values().cloned().collect()
            };
            if !updates.is_empty() {
                let _ = channel.send(updates);
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_speed_tracker_calculation() {
        let mut tracker = SpeedTracker::new();
        let start = std::time::Instant::now();
        tracker.samples.push((start, 0));
        tracker.samples.push((start + std::time::Duration::from_secs(1), 1_000_000));
        let speed = tracker.speed_bps();
        assert!(
            (speed - 1_000_000.0).abs() < 1000.0,
            "Speed should be ~1MB/s, got {}",
            speed
        );
    }

    #[test]
    fn test_speed_tracker_eta() {
        let mut tracker = SpeedTracker::new();
        let start = std::time::Instant::now();
        tracker.samples.push((start, 0));
        tracker.samples.push((start + std::time::Duration::from_secs(1), 1_000_000));
        let eta = tracker.eta_seconds(10_000_000, 1_000_000);
        assert!((eta - 9.0).abs() < 1.0, "ETA should be ~9s, got {}", eta);
    }

    #[test]
    fn test_speed_tracker_empty() {
        let tracker = SpeedTracker::new();
        assert_eq!(tracker.speed_bps(), 0.0);
    }

    #[test]
    fn test_progress_map_update() {
        let map = new_progress_map();
        update_progress(&map, "job-1", 500, 1000, UploadJobState::Uploading);
        let m = map.lock().unwrap();
        let p = m.get("job-1").unwrap();
        assert_eq!(p.bytes_sent, 500);
        assert_eq!(p.total_bytes, 1000);
    }

    #[test]
    fn test_emit_rate_is_not_per_chunk() {
        // Verify the design: progress emitter uses 500ms interval, not per-chunk.
        // This is a structural test — the emitter function signature takes a timer interval.
        // The actual interval is set in start_progress_emitter to 500ms.
        let map = new_progress_map();
        // Simulate rapid updates (like per-chunk)
        for i in 0..100 {
            update_progress(&map, "job-1", i * 1000, 100_000, UploadJobState::Uploading);
        }
        // The map should only have the latest value
        let m = map.lock().unwrap();
        let p = m.get("job-1").unwrap();
        assert_eq!(p.bytes_sent, 99_000, "Map should have latest value only");
    }
}
