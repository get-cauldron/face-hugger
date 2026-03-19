import { useState, useEffect } from 'react';
import { UploadCloud, Box, Database, Settings } from 'lucide-react';
import UserBadge from './UserBadge';
import { getPreference } from '../../lib/preferences';

interface SidebarProps {
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

type Section = 'models' | 'datasets' | 'settings';

const navItemBase =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-sidebar-foreground)] hover:bg-[var(--color-secondary)] mx-2 cursor-pointer transition-colors';

const navItemActive =
  'bg-[var(--color-secondary)] text-[var(--color-foreground)] font-medium';

const sectionHeader =
  'text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] px-3 pt-4 pb-1';

export default function Sidebar({ activeSection: activeSectionProp, onSectionChange }: SidebarProps) {
  const [activeSection, setActiveSection] = useState<Section>(
    (activeSectionProp as Section) ?? 'models'
  );
  const [recentModels, setRecentModels] = useState<string[]>([]);
  const [recentDatasets, setRecentDatasets] = useState<string[]>([]);

  // Sync activeSection from parent
  useEffect(() => {
    if (activeSectionProp) {
      setActiveSection(activeSectionProp as Section);
    }
  }, [activeSectionProp]);

  // Load recent repos from preferences
  useEffect(() => {
    async function loadRecent() {
      const [models, datasets] = await Promise.all([
        getPreference<string[]>('recentModels', []),
        getPreference<string[]>('recentDatasets', []),
      ]);
      setRecentModels(models);
      setRecentDatasets(datasets);
    }
    loadRecent();
  }, []);

  const handleSectionChange = (section: Section) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  // Show only repo short name (after the '/')
  function shortName(repoId: string): string {
    const parts = repoId.split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : repoId;
  }

  return (
    <aside className="w-60 flex flex-col h-[calc(100vh-40px)] bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)]">
      <nav className="flex-1 overflow-y-auto py-2">
        {/* Upload section — disabled placeholder */}
        <div>
          <p className={sectionHeader}>Upload</p>
          <div
            className={`${navItemBase} opacity-50 cursor-not-allowed`}
            aria-disabled="true"
          >
            <UploadCloud className="w-4 h-4 flex-shrink-0" />
            <span>Upload</span>
            <span className="text-xs ml-auto text-[var(--color-muted-foreground)]">Coming soon</span>
          </div>
        </div>

        {/* Models section */}
        <div>
          <p className={sectionHeader}>Models</p>
          <button
            className={`${navItemBase} w-full text-left ${activeSection === 'models' ? navItemActive : ''}`}
            onClick={() => handleSectionChange('models')}
          >
            <Box className="w-4 h-4 flex-shrink-0" />
            <span>Models</span>
          </button>
          {/* Recent models */}
          {recentModels.slice(0, 5).map((repoId) => (
            <div
              key={repoId}
              className="text-xs text-[var(--color-muted-foreground)] pl-8 py-1 hover:text-[var(--color-foreground)] cursor-pointer truncate mx-2 rounded"
              title={repoId}
            >
              {shortName(repoId)}
            </div>
          ))}
        </div>

        {/* Datasets section */}
        <div>
          <p className={sectionHeader}>Datasets</p>
          <button
            className={`${navItemBase} w-full text-left ${activeSection === 'datasets' ? navItemActive : ''}`}
            onClick={() => handleSectionChange('datasets')}
          >
            <Database className="w-4 h-4 flex-shrink-0" />
            <span>Datasets</span>
          </button>
          {/* Recent datasets */}
          {recentDatasets.slice(0, 5).map((repoId) => (
            <div
              key={repoId}
              className="text-xs text-[var(--color-muted-foreground)] pl-8 py-1 hover:text-[var(--color-foreground)] cursor-pointer truncate mx-2 rounded"
              title={repoId}
            >
              {shortName(repoId)}
            </div>
          ))}
        </div>

        {/* Settings section */}
        <div>
          <p className={sectionHeader}>Settings</p>
          <button
            className={`${navItemBase} w-full text-left ${activeSection === 'settings' ? navItemActive : ''}`}
            onClick={() => handleSectionChange('settings')}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {/* User badge at bottom */}
      <div className="border-t border-[var(--color-sidebar-border)] p-2">
        <UserBadge />
      </div>
    </aside>
  );
}
