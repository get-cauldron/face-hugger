import { useState } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import ModelsPage from '../../routes/models/ModelsPage';
import DatasetsPage from '../../routes/datasets/DatasetsPage';
import SettingsPage from '../../routes/settings/SettingsPage';

type Section = 'models' | 'datasets' | 'settings' | 'upload' | 'repo-browser';

function ContentArea({
  section,
  selectedRepoId,
  selectedRepoType,
}: {
  section: Section;
  selectedRepoId: string | null;
  selectedRepoType: 'model' | 'dataset';
}) {
  switch (section) {
    case 'models':
      return <ModelsPage />;
    case 'datasets':
      return <DatasetsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'upload':
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <p className="text-lg font-medium">Upload</p>
          <p className="text-sm mt-1">Upload queue UI — coming in plan 03-02</p>
        </div>
      );
    case 'repo-browser':
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <p className="text-lg font-medium">Repo Browser</p>
          {selectedRepoId ? (
            <p className="text-sm mt-1">
              {selectedRepoType}: {selectedRepoId}
            </p>
          ) : (
            <p className="text-sm mt-1">Select a repo to browse — coming in plan 03-04</p>
          )}
        </div>
      );
  }
}

export default function AppShell() {
  const [activeSection, setActiveSection] = useState<Section>('models');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [selectedRepoType, setSelectedRepoType] = useState<'model' | 'dataset'>('model');

  function navigateToRepo(repoId: string, repoType: 'model' | 'dataset') {
    setSelectedRepoId(repoId);
    setSelectedRepoType(repoType);
    setActiveSection('repo-browser');
  }

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
        <main className="flex-1 overflow-auto p-6 bg-background">
          <ContentArea
            section={activeSection}
            selectedRepoId={selectedRepoId}
            selectedRepoType={selectedRepoType}
          />
        </main>
      </div>
    </div>
  );
}
