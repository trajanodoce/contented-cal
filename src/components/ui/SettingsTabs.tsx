import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
  /** Badge count — only rendered when > 0 */
  count?: number;
}

interface SettingsTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Badge                                                              */
/* ------------------------------------------------------------------ */

function TabBadge({ count }: { count: number }) {
  const display = count > 99 ? '99+' : String(count);

  return (
    <span
      style={{
        minWidth: 18,
        height: 18,
        paddingLeft: 6,
        paddingRight: 6,
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        color: '#fff',
        background: '#005D97',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {display}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  SettingsTabs                                                       */
/* ------------------------------------------------------------------ */

export default function SettingsTabs({
  tabs,
  activeTab,
  onTabChange,
}: SettingsTabsProps) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid #00233918',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`settings-tab-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            style={{
              /* Reset */
              border: 'none',
              cursor: 'pointer',

              /* Layout */
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 10,
              paddingBottom: 10,
              marginBottom: -1,

              /* Typography */
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1,

              /* Color + underline */
              color: isActive ? '#005D97' : '#475569',
              background: 'transparent',
              borderBottom: isActive ? '2px solid #005D97' : '2px solid transparent',

              /* Transition — color + bg only, underline is instant */
              transition: 'color 150ms, background 150ms',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = '#334155';
                e.currentTarget.style.background = '#005D9708';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {/* 14px icon — sized via the wrapper span */}
            <span
              style={{
                display: 'inline-flex',
                width: 14,
                height: 14,
                flexShrink: 0,
              }}
            >
              {tab.icon}
            </span>

            {tab.label}

            {tab.count != null && tab.count > 0 && (
              <TabBadge count={tab.count} />
            )}
          </button>
        );
      })}
    </div>
  );
}
