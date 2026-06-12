import { useLocation, useNavigate } from 'react-router-dom';
import { ContentTypeEditor } from './ContentTypesTab';
import { ChannelsTab } from './ChannelsTab';
import { CustomFieldsTab } from './CustomFieldsTab';
import { BoardColumnsTab } from './BoardColumnsTab';
import { SubtaskTemplatesTab } from './SubtaskTemplatesTab';
import {
  FileText, Radio, SlidersHorizontal, Layout, ClipboardCheck,
} from 'lucide-react';

const SUB_TABS = [
  { slug: 'content-types', label: 'Content Types', icon: FileText },
  { slug: 'channels', label: 'Channels', icon: Radio },
  { slug: 'custom-fields', label: 'Custom Fields', icon: SlidersHorizontal },
  { slug: 'board-columns', label: 'Board Columns', icon: Layout },
  { slug: 'subtask-templates', label: 'Subtask Templates', icon: ClipboardCheck },
] as const;

type SubSlug = typeof SUB_TABS[number]['slug'];

function resolveSubTab(pathname: string): SubSlug {
  const segments = pathname.replace(/^\/settings\/customizations\/?/, '').split('/').filter(Boolean);
  const slug = segments[0] as SubSlug | undefined;
  if (slug && SUB_TABS.some(t => t.slug === slug)) return slug;
  return 'content-types';
}

interface CustomizationsTabProps {
  workspaceId: string | null;
}

export function CustomizationsTab({ workspaceId }: CustomizationsTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  // SettingsPage owns the redirect to /settings/customizations/<slug> when the
  // sub-slug is missing or invalid, so by the time we render we know there's
  // a valid sub-slug in the URL.
  const activeSlug = resolveSubTab(location.pathname);

  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
      {/* Sub-nav sidebar */}
      <nav
        className="shrink-0 py-[18px] px-3"
        style={{
          width: 220,
          backgroundColor: '#F7F9FC',
          borderRight: '1px solid rgb(var(--color-brand-900) / 0.094)',
        }}
      >
        <span
          className="block px-[13px] mb-2"
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Customizations
        </span>

        {SUB_TABS.map(tab => {
          const isActive = tab.slug === activeSlug;
          const Icon = tab.icon;

          return (
            <button
              key={tab.slug}
              type="button"
              onClick={() => navigate(`/settings/customizations/${tab.slug}`)}
              className="w-full text-left flex items-center gap-2 relative transition-colors"
              style={{
                padding: '8px 10px 8px 13px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: isActive ? 'rgb(var(--color-brand-600))' : '#334155',
                backgroundColor: isActive ? 'rgb(var(--color-brand-600) / 0.063)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--color-brand-600) / 0.031)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {isActive && (
                <span
                  className="absolute"
                  style={{
                    left: -3,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: 'rgb(var(--color-brand-600))',
                  }}
                />
              )}
              <Icon className="w-3.5 h-3.5 shrink-0" style={{ opacity: isActive ? 1 : 0.6 }} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <div className="flex-1 p-6 bg-surface-card min-h-[400px]">
        {activeSlug === 'content-types' && <ContentTypeEditor workspaceId={workspaceId} />}
        {activeSlug === 'channels' && <ChannelsTab workspaceId={workspaceId} />}
        {activeSlug === 'custom-fields' && <CustomFieldsTab workspaceId={workspaceId} />}
        {activeSlug === 'board-columns' && <BoardColumnsTab workspaceId={workspaceId} />}
        {activeSlug === 'subtask-templates' && <SubtaskTemplatesTab workspaceId={workspaceId} />}
      </div>
    </div>
  );
}
