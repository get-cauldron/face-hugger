import { invoke, Channel } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Types matching Rust specta types (src-tauri/src/upload/types.rs)
// ---------------------------------------------------------------------------

export type UploadJobState =
  | 'pending'
  | 'hashing'
  | 'uploading'
  | 'committing'
  | 'done'
  | 'failed'
  | 'paused'
  | 'cancelled';

export type UploadProtocol = 'xet' | 'lfs_multipart';

export interface UploadJob {
  id: string;
  file_path: string;
  file_name: string;
  repo_id: string;
  repo_type: string;
  revision: string;
  commit_message: string;
  total_bytes: number;
  bytes_confirmed: number;
  protocol: UploadProtocol | null;
  state: UploadJobState;
  priority: boolean;
  retry_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

export interface UploadProgress {
  job_id: string;
  bytes_sent: number;
  total_bytes: number;
  speed_bps: number;
  eta_seconds: number;
  state: UploadJobState;
}

// ---------------------------------------------------------------------------
// Helper: unwrap tauri-specta Result<T, E>
// ---------------------------------------------------------------------------

function unwrap<T>(
  result: { status: 'ok'; data: T } | { status: 'error'; error: string }
): T {
  if (result.status === 'error') throw new Error(result.error);
  return result.data;
}

// ---------------------------------------------------------------------------
// Command wrappers
// ---------------------------------------------------------------------------

/** Enqueue a file for upload. Returns the new UploadJob. */
export async function enqueueUpload(params: {
  filePath: string;
  repoId: string;
  repoType: string;
  revision?: string;
  commitMessage: string;
  priority?: boolean;
}): Promise<UploadJob> {
  const result = await invoke('enqueue_upload', {
    file_path: params.filePath,
    repo_id: params.repoId,
    repo_type: params.repoType,
    revision: params.revision ?? 'main',
    commit_message: params.commitMessage,
    priority: params.priority ?? false,
  });
  return unwrap(result as any);
}

/** Cancel a specific upload by job ID. */
export async function cancelUpload(jobId: string): Promise<void> {
  const result = await invoke('cancel_upload', { job_id: jobId });
  unwrap(result as any);
}

/** Pause a specific upload by job ID. */
export async function pauseUpload(jobId: string): Promise<void> {
  const result = await invoke('pause_upload', { job_id: jobId });
  unwrap(result as any);
}

/** Resume a paused upload by job ID. */
export async function resumeUpload(jobId: string): Promise<void> {
  const result = await invoke('resume_upload', { job_id: jobId });
  unwrap(result as any);
}

/** Pause all active uploads. Returns the number of uploads paused. */
export async function pauseAllUploads(): Promise<number> {
  const result = await invoke('pause_all_uploads');
  return unwrap(result as any);
}

/** List all upload jobs (all states). */
export async function listUploads(): Promise<UploadJob[]> {
  const result = await invoke('list_uploads');
  return unwrap(result as any);
}

/** Toggle priority flag on an upload job. */
export async function setUploadPriority(
  jobId: string,
  priority: boolean
): Promise<void> {
  const result = await invoke('set_upload_priority', {
    job_id: jobId,
    priority,
  });
  unwrap(result as any);
}

/**
 * Start the upload progress monitoring channel.
 * The callback receives Vec<UploadProgress> every 500ms containing all active jobs.
 * Progress is batched — never per-chunk.
 */
export function startUploadMonitoring(
  onProgress: (updates: UploadProgress[]) => void
): Promise<void> {
  const channel = new Channel<UploadProgress[]>();
  channel.onmessage = onProgress;
  return invoke('start_upload_monitoring', { channel }) as Promise<void>;
}

/**
 * Update the concurrent upload limit (1-5).
 * Persisted to tauri-plugin-store so value survives app restarts.
 */
export async function setConcurrentLimit(limit: number): Promise<void> {
  const result = await invoke('set_concurrent_limit', { limit });
  unwrap(result as any);
}
