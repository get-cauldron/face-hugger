import { useState, useEffect, useCallback } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { CloudUpload } from 'lucide-react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import ModelsPage from '../../routes/models/ModelsPage';
import DatasetsPage from '../../routes/datasets/DatasetsPage';
import SettingsPage from '../../routes/settings/SettingsPage';
import UploadPage from '../../routes/upload/UploadPage';
import RepoBrowserPage from '../../routes/repo-browser/RepoBrowserPage';
import MiniRepoPicker from '../../routes/upload/MiniRepoPicker';

type Section = 'models' | 'datasets' | 'settings' | 'upload' | 'repo-browser';

function ContentArea({
  section,
  selectedRepoId,
  selectedRepoType,
  onBack,
  onRepoSelect,
}: {
  section: Section;
  selectedRepoId: string | null;
  selectedRepoType: 'model' | 'dataset';
  onBack: () => void;
  onRepoSelect: (repoId: string, repoType: 'model' | 'dataset') => void;
}) {
  switch (section) {
    case 'models':
      return <ModelsPage onRepoSelect={onRepoSelect} />;
    case 'datasets':
      return <DatasetsPage onRepoSelect={onRepoSelect} />;
    case 'settings':
      return <SettingsPage />;
    case 'upload':
      return <UploadPage />;
    case 'repo-browser':
      return selectedRepoId ? (
        <RepoBrowserPage
          repoId={selectedRepoId}
          repoType={selectedRepoType}
          onBack={onBack}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <p className="text-lg font-medium">Repo Browser</p>
          <p className="text-sm mt-1">Select a repo from Models or Datasets to browse</p>
        </div>
      );
  }
}

export default function AppShell() {
  const [activeSection, setActiveSection] = useState<Section>('models');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [selectedRepoType, setSelectedRepoType] = useState<'model' | 'dataset'>('model');

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedPaths, setDroppedPaths] = useState<string[]>([]);
  const [miniPickerOpen, setMiniPickerOpen] = useState(false);

  function navigateToRepo(repoId: string, repoType: 'model' | 'dataset') {
    setSelectedRepoId(repoId);
    setSelectedRepoType(repoType);
    setActiveSection('repo-browser');
  }

  function handleBack() {
    // Navigate back to the appropriate list based on repo type
    setActiveSection(selectedRepoType === 'dataset' ? 'datasets' : 'models');
  }

  // App-wide drag-and-drop via Tauri webview events.
  // CRITICAL: Must use getCurrentWebview().onDragDropEvent — HTML5 ondrop does NOT fire
  // for OS file drops in Tauri desktop apps on macOS/Linux.
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload as {
          type: 'enter' | 'drop' | 'leave' | 'over';
          paths?: string[];
        };

        if (payload.type === 'enter' || payload.type === 'over') {
          setIsDragOver(true);
        } else if (payload.type === 'drop') {
          setIsDragOver(false);
          if (payload.paths && payload.paths.length > 0) {
            setDroppedPaths(payload.paths);
            setMiniPickerOpen(true);
          }
        } else if (payload.type === 'leave') {
          setIsDragOver(false);
        }
      })
      .then((unlisten) => {
        unlistenFn = unlisten;
      })
      .catch(() => {
        // Not in Tauri context (dev/test) — silently ignore
      });

    return () => {
      unlistenFn?.();
    };
  }, []);

  const handleMiniPickerConfirm = useCallback(
    (_repoId: string, _repoType: string) => {
      // Navigate to upload section so user can see the queued jobs
      setActiveSection('upload');
    },
    []
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(s) => setActiveSection(s as Section)}
          selectedRepoId={selectedRepoId}
          selectedRepoType={selectedRepoType}
          onNavigateToRepo={navigateToRepo}
        />
        <main className="flex-1 overflow-auto p-6 bg-background relative">
          <ContentArea
            section={activeSection}
            selectedRepoId={selectedRepoId}
            selectedRepoType={selectedRepoType}
            onBack={handleBack}
            onRepoSelect={navigateToRepo}
          />

          {/* Drag-over overlay — shown when OS files are dragged over the app window */}
          {isDragOver && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none"
              aria-hidden
            >
              <CloudUpload className="w-12 h-12 text-primary opacity-80" />
              <p className="text-base font-medium text-foreground">Drop files to upload</p>
              <p className="text-sm text-muted-foreground">
                You'll pick a repository in the next step
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Mini repo picker — opens when files are dropped onto the app */}
      <MiniRepoPicker
        open={miniPickerOpen}
        onOpenChange={setMiniPickerOpen}
        droppedPaths={droppedPaths}
        onConfirm={handleMiniPickerConfirm}
      />
    </div>
  );
}
