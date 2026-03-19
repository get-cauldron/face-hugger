import { useState } from 'react';
import { useRepoFiles } from '../../queries/useRepoFiles';
import CommitTimeline from './CommitTimeline';
import FileTree from './FileTree';
import { DeleteRepoDialog } from './FileActions';

interface RepoBrowserPageProps {
  repoId: string;
  repoType: 'model' | 'dataset';
  onBack: () => void;
}

type Tab = 'files' | 'history';

export default function RepoBrowserPage({ repoId, repoType, onBack }: RepoBrowserPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [deleteRepoOpen, setDeleteRepoOpen] = useState(false);

  const { data: files, isPending, isError, refetch } = useRepoFiles(repoId, repoType);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{repoId}</h1>
          <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground capitalize flex-shrink-0">
            {repoType}
          </span>
        </div>
        <button
          onClick={() => setDeleteRepoOpen(true)}
          className="flex-shrink-0 text-sm px-3 py-1.5 rounded-md border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer"
        >
          Delete Repository
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-4">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'files'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'history'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'files' && (
          <>
            {isPending && (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <p className="text-sm">Loading files...</p>
              </div>
            )}
            {isError && (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                <p className="text-sm text-destructive">Failed to load files</p>
                <button
                  onClick={() => refetch()}
                  className="text-sm text-primary hover:underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
            {!isPending && !isError && files && (
              <FileTree
                files={files}
                repoId={repoId}
                repoType={repoType}
              />
            )}
          </>
        )}
        {activeTab === 'history' && (
          <CommitTimeline repoId={repoId} repoType={repoType} />
        )}
      </div>

      {/* Delete repo dialog */}
      <DeleteRepoDialog
        open={deleteRepoOpen}
        onOpenChange={setDeleteRepoOpen}
        repoId={repoId}
        repoType={repoType}
        onDeleted={onBack}
      />
    </div>
  );
}
