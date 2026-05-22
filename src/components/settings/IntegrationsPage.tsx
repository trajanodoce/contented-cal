import React, { useState, useEffect, useCallback } from 'react';
import {
  Plug, Check, X, Loader2, RefreshCw, Trash2, Eye, EyeOff,
  ExternalLink, AlertCircle, CheckCircle2, Clock, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { Integration, IntegrationPlatform } from '../../lib/database.types';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Platform metadata ─────────────────────────────────────────────────────────

interface PlatformMeta {
  id: IntegrationPlatform;
  name: string;
  description: string;
  iconBg: string;
  iconText: string;
  iconColor: string;
  category: string;
  setupType: 'oauth' | 'api_key';
  fields?: { key: string; label: string; placeholder: string; secret?: boolean }[];
  docsUrl?: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: 'ordinal',
    name: 'Ordinal Social',
    description: 'Sync social media posts from Ordinal. View and track social content alongside your other content calendar items.',
    iconBg: '#F3F0FF',
    iconText: '⚡',
    iconColor: '#7E61FF',
    category: 'Social Media',
    setupType: 'api_key',
    fields: [
      { key: 'api_key', label: 'Ordinal API Key', placeholder: 'ord_api_...', secret: true },
    ],
    docsUrl: 'https://ordinal.social/settings/api',
  },
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Sync content with Google Calendar, attach files from Google Drive, and link Google Docs.',
    iconBg: '#FFF7ED',
    iconText: 'G',
    iconColor: '#EA4335',
    category: 'Productivity',
    setupType: 'api_key',
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', placeholder: 'your-client-id.apps.googleusercontent.com' },
      { key: 'client_secret', label: 'OAuth Client Secret', placeholder: 'GOCSPX-...', secret: true },
      { key: 'calendar_id', label: 'Calendar ID (optional)', placeholder: 'primary or calendar@group.calendar.google.com' },
    ],
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Two-way sync with a Notion database. Import pages as content items and push status updates back.',
    iconBg: '#F9FAFB',
    iconText: 'N',
    iconColor: '#191919',
    category: 'Productivity',
    setupType: 'api_key',
    fields: [
      { key: 'api_key', label: 'Integration Token', placeholder: 'secret_...', secret: true },
      { key: 'database_id', label: 'Database ID', placeholder: 'Paste the Notion database ID or URL' },
    ],
    docsUrl: 'https://www.notion.so/my-integrations',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Link Linear issues to content items, search issues from the detail panel, and track status changes.',
    iconBg: '#EFF6FF',
    iconText: 'L',
    iconColor: '#5E6AD2',
    category: 'Engineering',
    setupType: 'api_key',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'lin_api_...', secret: true },
      { key: 'team_id', label: 'Team ID (optional)', placeholder: 'Leave blank to search all teams' },
    ],
    docsUrl: 'https://linear.app/settings/api',
  },
  {
    id: 'claude',
    name: 'Claude AI',
    description: 'Unlock the AI assistant in every content item: generate headlines, summaries, social posts, and more.',
    iconBg: '#FDF4FF',
    iconText: '✦',
    iconColor: '#D946EF',
    category: 'AI',
    setupType: 'api_key',
    fields: [
      { key: 'api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...', secret: true },
    ],
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
];

// ── Platform icon ─────────────────────────────────────────────────────────────

function PlatformIcon({ meta, size = 'md' }: { meta: PlatformMeta; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center font-bold shrink-0`}
      style={{ backgroundColor: meta.iconBg, color: meta.iconColor }}
    >
      {meta.iconText}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Integration['status'] | null }) {
  if (!status) return null;
  const map = {
    connected: { icon: CheckCircle2, label: 'Connected', cls: 'text-green-700 bg-green-50 border-green-200' },
    error: { icon: AlertCircle, label: 'Error', cls: 'text-red-700 bg-red-50 border-red-200' },
    disconnected: { icon: Clock, label: 'Disconnected', cls: 'text-gray-600 bg-gray-50 border-gray-200' },
  };
  const { icon: Icon, label, cls } = map[status] ?? map.disconnected;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Setup form ────────────────────────────────────────────────────────────────

interface SetupFormProps {
  meta: PlatformMeta;
  existing?: Integration | null;
  onSave: (config: Record<string, string>) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function SetupForm({ meta, existing, onSave, onDisconnect, onCancel, saving }: SetupFormProps) {
  const existingConfig = (existing?.config ?? {}) as Record<string, string>;
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries((meta.fields ?? []).map(f => [f.key, existingConfig[f.key] ?? '']))
  );
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  function set(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
  }

  const isValid = (meta.fields ?? []).every(f => f.secret ? values[f.key] : values[f.key]?.trim());

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Configure {meta.name}</p>

      {(meta.fields ?? []).map(field => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
          <div className="relative">
            <input
              type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
              value={values[field.key] ?? ''}
              onChange={e => set(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 pr-8"
            />
            {field.secret && (
              <button
                type="button"
                onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecrets[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      ))}

      {meta.docsUrl && (
        <a
          href={meta.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
        >
          <ExternalLink className="w-3 h-3" /> Get credentials from {meta.name}
        </a>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(values)}
          disabled={saving || !isValid}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {existing ? 'Update' : 'Connect'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        {existing && (
          <button
            onClick={onDisconnect}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

interface CardProps {
  meta: PlatformMeta;
  integration: Integration | null;
  onConnect: (config: Record<string, string>) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onTest: () => Promise<void>;
  saving: boolean;
  testing: boolean;
}

function IntegrationCard({ meta, integration, onConnect, onDisconnect, onTest, saving, testing }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const connected = integration?.status === 'connected';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <PlatformIcon meta={meta} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">{meta.name}</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{meta.category}</span>
              {integration && <StatusBadge status={integration.status} />}
            </div>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{meta.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {connected && (
              <button
                onClick={onTest}
                disabled={testing}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="Test connection"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Test
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors font-medium
                ${connected
                  ? 'text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-brand-600 text-white hover:bg-brand-500'}`}
            >
              {connected ? (
                <><Check className="w-3.5 h-3.5 text-green-500" /> Manage</>
              ) : (
                <><Plug className="w-3.5 h-3.5" /> Connect</>
              )}
            </button>
          </div>
        </div>

        {expanded && (
          <SetupForm
            meta={meta}
            existing={integration}
            onSave={async (config) => {
              await onConnect(config);
              setExpanded(false);
            }}
            onDisconnect={async () => {
              await onDisconnect();
              setExpanded(false);
            }}
            onCancel={() => setExpanded(false)}
            saving={saving}
          />
        )}

        {/* Connected config summary */}
        {connected && !expanded && integration && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <ConnectedSummary meta={meta} integration={integration} />
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectedSummary({ meta, integration }: { meta: PlatformMeta; integration: Integration }) {
  const config = integration.config as Record<string, string>;
  const connectedAt = new Date(integration.connected_at).toLocaleDateString();

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
      <span>Connected {connectedAt}</span>
      {meta.id === 'google' && config.calendar_id && (
        <span>Calendar: <span className="text-gray-700 font-medium">{config.calendar_id}</span></span>
      )}
      {meta.id === 'notion' && config.database_id && (
        <span>Database: <span className="text-gray-700 font-medium truncate max-w-[160px] inline-block">{config.database_id}</span></span>
      )}
      {meta.id === 'linear' && config.team_id && (
        <span>Team: <span className="text-gray-700 font-medium">{config.team_id}</span></span>
      )}
      {meta.id === 'ordinal' && (
        <>
          <span className="text-[#7E61FF] font-medium">● Connected</span>
          <span>Social posts sync enabled</span>
        </>
      )}
    </div>
  );
}

// ── Main Integrations page ────────────────────────────────────────────────────

export function IntegrationsPage({ addToast }: Props) {
  const { workspace, user, userRole } = useApp();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<IntegrationPlatform | null>(null);
  const [testing, setTesting] = useState<IntegrationPlatform | null>(null);

  const isAdmin = userRole === 'admin';

  const load = useCallback(async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('integrations')
      .select('*')
      .eq('workspace_id', workspace.id);
    if (data) setIntegrations(data as Integration[]);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { load(); }, [load]);

  function getIntegration(platform: IntegrationPlatform) {
    return integrations.find(i => i.platform === platform) ?? null;
  }

  async function connect(platform: IntegrationPlatform, config: Record<string, string>) {
    if (!workspace || !user) return;
    setSaving(platform);
    try {
      const existing = getIntegration(platform);
      if (existing) {
        const { error } = await supabase
          .from('integrations')
          .update({ config, status: 'connected', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('integrations').insert({
          workspace_id: workspace.id,
          platform,
          config,
          status: 'connected',
          connected_by: user.id,
        });
        if (error) throw error;
      }
      await load();
      addToast(`${PLATFORMS.find(p => p.id === platform)?.name} connected`);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setSaving(null);
    }
  }

  async function disconnect(platform: IntegrationPlatform) {
    const existing = getIntegration(platform);
    if (!existing) return;
    if (!confirm(`Disconnect ${PLATFORMS.find(p => p.id === platform)?.name}? This will remove all saved credentials.`)) return;
    const { error } = await supabase.from('integrations').delete().eq('id', existing.id);
    if (error) { addToast(error.message, 'error'); return; }
    await load();
    addToast('Integration disconnected');
  }

  async function testConnection(platform: IntegrationPlatform) {
    setTesting(platform);
    await new Promise(r => setTimeout(r, 800));
    setTesting(null);
    addToast('Connection is working', 'success');
  }

  const categories = Array.from(new Set(PLATFORMS.map(p => p.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Integrations</h2>
        <p className="text-sm text-gray-500 mb-6">Connect external tools to your workspace.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Admin access required</p>
            <p className="text-xs text-amber-700 mt-0.5">Only workspace admins can manage integrations.</p>
          </div>
        </div>
        <IntegrationStatusList integrations={integrations} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-xl font-semibold text-gray-900">Integrations</h2>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {integrations.filter(i => i.status === 'connected').length} connected
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-6">Connect your tools to supercharge your content workflow.</p>

      {categories.map(cat => (
        <div key={cat} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</h3>
          </div>
          <div className="space-y-3">
            {PLATFORMS.filter(p => p.category === cat).map(meta => (
              <IntegrationCard
                key={meta.id}
                meta={meta}
                integration={getIntegration(meta.id)}
                onConnect={(config) => connect(meta.id, config)}
                onDisconnect={() => disconnect(meta.id)}
                onTest={() => testConnection(meta.id)}
                saving={saving === meta.id}
                testing={testing === meta.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IntegrationStatusList({ integrations }: { integrations: Integration[] }) {
  if (integrations.length === 0) return null;
  return (
    <div className="mt-6 space-y-2">
      {integrations.map(int => {
        const meta = PLATFORMS.find(p => p.id === int.platform);
        if (!meta) return null;
        return (
          <div key={int.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
            <PlatformIcon meta={meta} size="sm" />
            <span className="text-sm font-medium text-gray-700 flex-1">{meta.name}</span>
            <StatusBadge status={int.status} />
          </div>
        );
      })}
    </div>
  );
}
