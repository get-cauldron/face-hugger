use std::time::Duration;

/// Exponential backoff: 5s, 15s, 30s, 60s cap — with +/-20% jitter.
/// Per CONTEXT.md locked decision.
pub fn backoff_duration(retry_count: u32) -> Duration {
    let base_ms: u64 = match retry_count {
        0 => 5_000,
        1 => 15_000,
        2 => 30_000,
        _ => 60_000,
    };
    let jitter = (rand::random::<f64>() * 0.4 - 0.2) * base_ms as f64;
    Duration::from_millis((base_ms as f64 + jitter).max(1000.0) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backoff_schedule() {
        // Test multiple times due to jitter
        for _ in 0..10 {
            let d0 = backoff_duration(0);
            assert!(
                d0.as_millis() >= 4000 && d0.as_millis() <= 6000,
                "retry 0 ~5s: got {}ms",
                d0.as_millis()
            );
            let d1 = backoff_duration(1);
            assert!(
                d1.as_millis() >= 12000 && d1.as_millis() <= 18000,
                "retry 1 ~15s: got {}ms",
                d1.as_millis()
            );
            let d2 = backoff_duration(2);
            assert!(
                d2.as_millis() >= 24000 && d2.as_millis() <= 36000,
                "retry 2 ~30s: got {}ms",
                d2.as_millis()
            );
            let d3 = backoff_duration(3);
            assert!(
                d3.as_millis() >= 48000 && d3.as_millis() <= 72000,
                "retry 3+ ~60s: got {}ms",
                d3.as_millis()
            );
        }
    }

    #[test]
    fn test_backoff_caps_at_60s() {
        for retry in 3..100 {
            let d = backoff_duration(retry);
            assert!(d.as_millis() <= 72000, "Backoff must cap near 60s");
        }
    }
}
