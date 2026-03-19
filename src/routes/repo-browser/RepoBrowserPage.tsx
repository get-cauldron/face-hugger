import { useState } from 'react';
import CommitTimeline from './CommitTimeline';

interface RepoBrowserPageProps {
  repoId: string;
  repoType: 'model' | 'dataset';
  onBack: () => void;
}

type Tab = 'files' | 'history';

export default function RepoBrowserPage({ repoId, repoType, onBack }: RepoBrowserPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('files');

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
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold truncate">{repoId}</h1>
          <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground capitalize">
            {repoType}
          </span>
        </div>
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
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <p className="text-sm">File tree — coming in plan 03-04</p>
          </div>
        )}
        {activeTab === 'history' && (
          <CommitTimeline repoId={repoId} repoType={repoType} />
        )}
      </div>
    </div>
  );
}
