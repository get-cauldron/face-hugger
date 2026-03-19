CREATE TABLE IF NOT EXISTS upload_jobs (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    repo_id TEXT NOT NULL,
    repo_type TEXT NOT NULL CHECK(repo_type IN ('model', 'dataset', 'space')),
    revision TEXT NOT NULL DEFAULT 'main',
    commit_message TEXT NOT NULL,
    total_bytes INTEGER NOT NULL,
    bytes_confirmed INTEGER NOT NULL DEFAULT 0,
    protocol TEXT CHECK(protocol IN ('xet', 'lfs_multipart') OR protocol IS NULL),
    state TEXT NOT NULL DEFAULT 'pending'
        CHECK(state IN ('pending', 'hashing', 'uploading', 'committing', 'done', 'failed', 'paused', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS confirmed_xorbs (
    job_id TEXT NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
    xorb_hash TEXT NOT NULL,
    PRIMARY KEY (job_id, xorb_hash)
);

CREATE TABLE IF NOT EXISTS confirmed_lfs_parts (
    job_id TEXT NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL,
    PRIMARY KEY (job_id, part_number)
);

CREATE INDEX idx_upload_jobs_state ON upload_jobs(state);
CREATE INDEX idx_upload_jobs_priority_created ON upload_jobs(priority DESC, created_at ASC);
