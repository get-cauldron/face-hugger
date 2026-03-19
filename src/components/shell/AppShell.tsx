import { useState } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import ModelsPage from '../../routes/models/ModelsPage';
import DatasetsPage from '../../routes/datasets/DatasetsPage';
import SettingsPage from '../../routes/settings/SettingsPage';

type Section = 'models' | 'datasets' | 'settings';

function ContentArea({ section }: { section: Section }) {
  switch (section) {
    case 'models':
      return <ModelsPage />;
    case 'datasets':
      return <DatasetsPage />;
    case 'settings':
      return <SettingsPage />;
  }
}

export default function AppShell() {
  const [activeSection, setActiveSection] = useState<Section>('models');

  return (
    <div className="flex flex-col h-screen bg-background">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(s) => setActiveSection(s as Section)}
        />
        <main className="flex-1 overflow-auto p-6 bg-background">
          <ContentArea section={activeSection} />
        </main>
      </div>
    </div>
  );
}
