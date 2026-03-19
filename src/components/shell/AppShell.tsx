import { useState } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';

type Section = 'models' | 'datasets' | 'settings';

function ContentArea({ section }: { section: Section }) {
  switch (section) {
    case 'models':
      return (
        <div className="text-[var(--color-muted-foreground)]">
          Models page placeholder
        </div>
      );
    case 'datasets':
      return (
        <div className="text-[var(--color-muted-foreground)]">
          Datasets page placeholder
        </div>
      );
    case 'settings':
      return (
        <div className="text-[var(--color-muted-foreground)]">
          Settings page placeholder
        </div>
      );
  }
}

export default function AppShell() {
  const [activeSection, setActiveSection] = useState<Section>('models');

  return (
    <div className="flex flex-col h-screen bg-[var(--color-background)]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onSectionChange={(s) => setActiveSection(s as Section)} />
        <main className="flex-1 overflow-auto p-6 bg-[var(--color-background)]">
          <ContentArea section={activeSection} />
        </main>
      </div>
    </div>
  );
}
