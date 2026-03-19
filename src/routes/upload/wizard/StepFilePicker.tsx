import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, stat } from '@tauri-apps/plugin-fs';
import { formatBytes } from '../../../lib/repoUtils';
import { FolderOpen, Upload, X, FileIcon } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface FileEntry {
  path: string;
  name: string;
  size: number;
}

interface StepFilePickerProps {
  files: FileEntry[];
  onFilesChange: (files: FileEntry[]) => void;
}

async function getFileStat(path: string): Promise<number> {
  try {
    const s = await stat(path);
    return s.size ?? 0;
  } catch {
    return 0;
  }
}

async function collectFilesFromPaths(paths: string[]): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  for (const p of paths) {
    const size = await getFileStat(p);
    const name = p.split('/').pop() ?? p.split('\\').pop() ?? p;
    entries.push({ path: p, name, size });
  }
  return entries;
}

async function collectFilesFromFolder(folderPath: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  async function recurse(dir: string) {
    try {
      const items = await readDir(dir);
      for (const item of items) {
        const fullPath = `${dir}/${item.name}`;
        if (item.isFile) {
          const size = await getFileStat(fullPath);
          entries.push({ path: fullPath, name: item.name ?? '', size });
        } else if (item.isDirectory) {
          await recurse(fullPath);
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  await recurse(folderPath);
  return entries;
}

export default function StepFilePicker({ files, onFilesChange }: StepFilePickerProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function deduplicateAndMerge(existing: FileEntry[], incoming: FileEntry[]): FileEntry[] {
    const existingPaths = new Set(existing.map((f) => f.path));
    const newFiles = incoming.filter((f) => !existingPaths.has(f.path));
    return [...existing, ...newFiles];
  }

  const handleBrowseFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await open({ multiple: true, directory: false });
      if (!result) return;
      const paths = Array.isArray(result) ? result : [result];
      const newFiles = await collectFilesFromPaths(paths);
      onFilesChange(deduplicateAndMerge(files, newFiles));
    } finally {
      setIsLoading(false);
    }
  }, [files, onFilesChange]);

  const handleBrowseFolder = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await open({ directory: true, multiple: false });
      if (!result) return;
      const folderPath = Array.isArray(result) ? result[0] : result;
      const newFiles = await collectFilesFromFolder(folderPath);
      onFilesChange(deduplicateAndMerge(files, newFiles));
    } finally {
      setIsLoading(false);
    }
  }, [files, onFilesChange]);

  const removeFile = useCallback(
    (path: string) => {
      onFilesChange(files.filter((f) => f.path !== path));
    },
    [files, onFilesChange]
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Drag zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-border bg-secondary/30'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          // Tauri drag-drop is handled via onDragDropEvent in Tauri;
          // this handler provides visual feedback. Files are added via buttons below.
        }}
      >
        <Upload className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          Drag files here, or use the buttons below
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBrowseFiles}
          disabled={isLoading}
          className="flex-1"
        >
          <FileIcon className="w-3.5 h-3.5 mr-1.5" />
          Browse Files
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBrowseFolder}
          disabled={isLoading}
          className="flex-1"
        >
          <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
          Browse Folder
        </Button>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                    File
                  </th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium w-24">
                    Size
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.path}
                    className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-foreground truncate max-w-0" style={{ maxWidth: '1px' }}>
                      <span className="truncate block" title={file.path}>
                        {file.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {formatBytes(file.size)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeFile(file.path)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-1 border-t border-border/50">
        <span>
          {files.length} file{files.length !== 1 ? 's' : ''} selected
        </span>
        {files.length > 0 && (
          <span>Total: {formatBytes(totalSize)}</span>
        )}
      </div>
    </div>
  );
}
