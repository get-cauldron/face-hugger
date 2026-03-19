use sqlx::SqlitePool;

pub async fn insert_job(
    pool: &SqlitePool,
    id: &str,
    file_path: &str,
    file_name: &str,
    repo_id: &str,
    repo_type: &str,
    revision: &str,
    commit_message: &str,
    total_bytes: i64,
    priority: bool,
    created_at: i64,
) -> Result<(), sqlx::Error> {
    let priority_val: i32 = if priority { 1 } else { 0 };
    sqlx::query(
        "INSERT INTO upload_jobs (id, file_path, file_name, repo_id, repo_type, revision, commit_message, total_bytes, priority, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)"
    )
    .bind(id)
    .bind(file_path)
    .bind(file_name)
    .bind(repo_id)
    .bind(repo_type)
    .bind(revision)
    .bind(commit_message)
    .bind(total_bytes)
    .bind(priority_val)
    .bind(created_at)
    .bind(created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_job(pool: &SqlitePool, id: &str) -> Result<Option<JobRow>, sqlx::Error> {
    let row = sqlx::query_as::<_, JobRow>("SELECT * FROM upload_jobs WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn list_jobs(pool: &SqlitePool) -> Result<Vec<JobRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, JobRow>(
        "SELECT * FROM upload_jobs ORDER BY priority DESC, created_at ASC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn list_jobs_by_state(pool: &SqlitePool, state: &str) -> Result<Vec<JobRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, JobRow>(
        "SELECT * FROM upload_jobs WHERE state = ? ORDER BY priority DESC, created_at ASC"
    )
    .bind(state)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn update_job_state(
    pool: &SqlitePool,
    id: &str,
    state: &str,
    updated_at: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE upload_jobs SET state = ?, updated_at = ? WHERE id = ?")
        .bind(state)
        .bind(updated_at)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_job_progress(
    pool: &SqlitePool,
    id: &str,
    bytes_confirmed: i64,
    updated_at: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE upload_jobs SET bytes_confirmed = ?, updated_at = ? WHERE id = ?")
        .bind(bytes_confirmed)
        .bind(updated_at)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_job_protocol(
    pool: &SqlitePool,
    id: &str,
    protocol: &str,
    updated_at: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE upload_jobs SET protocol = ?, updated_at = ? WHERE id = ?")
        .bind(protocol)
        .bind(updated_at)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_job_error(
    pool: &SqlitePool,
    id: &str,
    error: &str,
    retry_count: i32,
    updated_at: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE upload_jobs SET state = 'failed', last_error = ?, retry_count = ?, updated_at = ? WHERE id = ?")
        .bind(error)
        .bind(retry_count)
        .bind(updated_at)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn insert_confirmed_xorb(
    pool: &SqlitePool,
    job_id: &str,
    xorb_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT OR IGNORE INTO confirmed_xorbs (job_id, xorb_hash) VALUES (?, ?)")
        .bind(job_id)
        .bind(xorb_hash)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_confirmed_xorbs(pool: &SqlitePool, job_id: &str) -> Result<Vec<String>, sqlx::Error> {
    let rows: Vec<(String,)> = sqlx::query_as("SELECT xorb_hash FROM confirmed_xorbs WHERE job_id = ?")
        .bind(job_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn insert_confirmed_lfs_part(
    pool: &SqlitePool,
    job_id: &str,
    part_number: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT OR IGNORE INTO confirmed_lfs_parts (job_id, part_number) VALUES (?, ?)")
        .bind(job_id)
        .bind(part_number)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_confirmed_lfs_parts(pool: &SqlitePool, job_id: &str) -> Result<Vec<i32>, sqlx::Error> {
    let rows: Vec<(i32,)> = sqlx::query_as("SELECT part_number FROM confirmed_lfs_parts WHERE job_id = ?")
        .bind(job_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn delete_job(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM upload_jobs WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Row type for query results (sqlx::FromRow)
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct JobRow {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub repo_id: String,
    pub repo_type: String,
    pub revision: String,
    pub commit_message: String,
    pub total_bytes: i64,
    pub bytes_confirmed: i64,
    pub protocol: Option<String>,
    pub state: String,
    pub priority: i32,
    pub retry_count: i32,
    pub last_error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
    use sqlx::Row;

    async fn test_pool() -> SqlitePool {
        let opts = SqliteConnectOptions::new()
            .filename(":memory:")
            .journal_mode(SqliteJournalMode::Wal)
            .create_if_missing(true);
        // Use max_connections(1) so all pool connections share the same in-memory DB
        let pool = sqlx::pool::PoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_insert_and_get_job() {
        let pool = test_pool().await;
        insert_job(&pool, "test-1", "/tmp/file.bin", "file.bin", "user/repo", "model", "main", "test upload", 1024, false, 1000).await.unwrap();
        let job = get_job(&pool, "test-1").await.unwrap().unwrap();
        assert_eq!(job.id, "test-1");
        assert_eq!(job.state, "pending");
        assert_eq!(job.total_bytes, 1024);
    }

    #[tokio::test]
    async fn test_update_job_state() {
        let pool = test_pool().await;
        insert_job(&pool, "test-2", "/tmp/file.bin", "file.bin", "user/repo", "model", "main", "test", 2048, false, 1000).await.unwrap();
        update_job_state(&pool, "test-2", "uploading", 1001).await.unwrap();
        let job = get_job(&pool, "test-2").await.unwrap().unwrap();
        assert_eq!(job.state, "uploading");
    }

    #[tokio::test]
    async fn test_confirmed_xorbs() {
        let pool = test_pool().await;
        insert_job(&pool, "test-3", "/tmp/file.bin", "file.bin", "user/repo", "model", "main", "test", 4096, false, 1000).await.unwrap();
        insert_confirmed_xorb(&pool, "test-3", "abc123").await.unwrap();
        insert_confirmed_xorb(&pool, "test-3", "def456").await.unwrap();
        let xorbs = get_confirmed_xorbs(&pool, "test-3").await.unwrap();
        assert_eq!(xorbs.len(), 2);
        assert!(xorbs.contains(&"abc123".to_string()));
    }

    #[tokio::test]
    async fn test_confirmed_lfs_parts() {
        let pool = test_pool().await;
        insert_job(&pool, "test-4", "/tmp/file.bin", "file.bin", "user/repo", "model", "main", "test", 4096, false, 1000).await.unwrap();
        insert_confirmed_lfs_part(&pool, "test-4", 1).await.unwrap();
        insert_confirmed_lfs_part(&pool, "test-4", 3).await.unwrap();
        let parts = get_confirmed_lfs_parts(&pool, "test-4").await.unwrap();
        assert_eq!(parts.len(), 2);
        assert!(parts.contains(&1));
        assert!(parts.contains(&3));
    }

    #[tokio::test]
    async fn test_no_urls_in_schema() {
        // Verify the schema does NOT store pre-signed URLs — only part numbers
        let pool = test_pool().await;
        // confirmed_lfs_parts only has job_id + part_number, no URL column
        let result = sqlx::query("SELECT sql FROM sqlite_master WHERE name = 'confirmed_lfs_parts'")
            .fetch_one(&pool)
            .await
            .unwrap();
        let sql: String = result.get("sql");
        assert!(!sql.to_lowercase().contains("url"), "Schema must NOT contain URL columns — pre-signed URLs expire and must never be persisted");
    }

    #[tokio::test]
    async fn test_list_jobs_priority_order() {
        let pool = test_pool().await;
        insert_job(&pool, "normal-1", "/tmp/a.bin", "a.bin", "user/repo", "model", "main", "test", 1024, false, 1000).await.unwrap();
        insert_job(&pool, "priority-1", "/tmp/b.bin", "b.bin", "user/repo", "model", "main", "test", 2048, true, 1001).await.unwrap();
        insert_job(&pool, "normal-2", "/tmp/c.bin", "c.bin", "user/repo", "model", "main", "test", 512, false, 999).await.unwrap();
        let jobs = list_jobs(&pool).await.unwrap();
        assert_eq!(jobs[0].id, "priority-1", "Priority job should be first");
    }

    #[tokio::test]
    async fn test_pause_survives_restart() {
        let pool = test_pool().await;
        insert_job(&pool, "pause-test", "/tmp/file.bin", "file.bin", "user/repo", "model", "main", "test", 8192, false, 1000).await.unwrap();
        update_job_state(&pool, "pause-test", "paused", 1001).await.unwrap();
        update_job_progress(&pool, "pause-test", 4096, 1001).await.unwrap();
        // Simulate restart by re-querying
        let job = get_job(&pool, "pause-test").await.unwrap().unwrap();
        assert_eq!(job.state, "paused");
        assert_eq!(job.bytes_confirmed, 4096);
    }
}
