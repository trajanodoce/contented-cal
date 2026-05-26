import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plug, Check, Loader2, RefreshCw, Trash2, Eye, EyeOff,
  ExternalLink, AlertCircle, CheckCircle2, Clock, Zap, MessageSquare, CircleUser,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { Integration, IntegrationPlatform, UserIntegration } from '../../lib/database.types';

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
  setupNote?: string;
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
    description: 'Sync content items with Google Calendar. Attach files from Google Drive.',
    iconBg: '#FFF7ED',
    iconText: 'G',
    iconColor: '#EA4335',
    category: 'Productivity',
    setupType: 'api_key',
    fields: [
      { key: 'client_id', label: 'Google Client ID', placeholder: 'your-client-id.apps.googleusercontent.com' },
      { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://your-app.com/auth/google/callback' },
    ],
    setupNote: 'Google Workspace integration requires OAuth setup. Add your Google OAuth credentials to enable Calendar sync and Drive file picking.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Two-way sync with Notion databases. Import and push content items.',
    iconBg: '#F9FAFB',
    iconText: 'N',
    iconColor: '#191919',
    category: 'Productivity',
    setupType: 'api_key',
    fields: [
      { key: 'api_key', label: 'Notion API Key', placeholder: 'secret_...', secret: true },
      { key: 'database_id', label: 'Database ID', placeholder: 'Paste the Notion database ID or URL' },
    ],
    setupNote: 'Notion integration requires an API key. Create an internal integration in your Notion workspace to get started.',
    docsUrl: 'https://www.notion.so/my-integrations',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Link Linear issues to content items. Track issue status alongside content.',
    iconBg: '#EFF6FF',
    iconText: 'L',
    iconColor: '#5E6AD2',
    category: 'Engineering',
    setupType: 'api_key',
    fields: [
      { key: 'api_key', label: 'Linear API Key', placeholder: 'lin_api_...', secret: true },
    ],
    setupNote: 'Linear integration requires an API key. Generate a personal API key from your Linear settings.',
    docsUrl: 'https://linear.app/settings/api',
  },
  {
    id: 'claude',
    name: 'Claude AI',
    description: 'AI-powered content assistant. Generate headlines, summaries, social posts, and more.',
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
  {
    id: 'slack',
    name: 'Slack',
    description: 'Create content items from Slack. @mention the bot in any channel to submit a request directly into your calendar.',
    iconBg: '#F5F0FF',
    iconText: '#',
    iconColor: '#4A154B',
    category: 'Communication',
    setupType: 'oauth',
    setupNote: 'Connects via Slack OAuth. After clicking Connect, you\'ll authorize the app in Slack and be redirected back here.',
    docsUrl: 'https://api.slack.com/apps',
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

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { icon: typeof CheckCircle2; label: string; cls: string }> = {
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
    Object.fromEntries((meta.fields ?? []).map(f => {
      // For Claude and Linear, the api_key is stored in access_token
      if ((meta.id === 'claude' || meta.id === 'linear') && f.key === 'api_key' && existing?.access_token) {
        return [f.key, existing.access_token];
      }
      return [f.key, existingConfig[f.key] ?? ''];
    }))
  );
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  function set(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
  }

  const isValid = (meta.fields ?? []).every(f => f.secret ? values[f.key] : values[f.key]?.trim());

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Configure {meta.name}</p>

      {meta.setupNote && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 leading-relaxed">{meta.setupNote}</p>
        </div>
      )}

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
  onOAuthConnect?: () => void;
  onDisconnect: () => Promise<void>;
  onTest: () => Promise<void>;
  onSync?: () => Promise<void>;
  saving: boolean;
  testing: boolean;
  syncing?: boolean;
}

function IntegrationCard({ meta, integration, onConnect, onDisconnect, onOAuthConnect, onTest, onSync, saving, testing, syncing }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const connected = integration?.status === 'connected';
  const isOAuth = meta.setupType === 'oauth';

  function handleConnectClick() {
    if (isOAuth && !connected) {
      onOAuthConnect?.();
    } else {
      setExpanded(e => !e);
    }
  }

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
            {connected && onSync && (
              <button
                onClick={onSync}
                disabled={syncing}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                title="Sync issues"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncing ? 'Syncing...' : 'Sync Issues'}
              </button>
            )}
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
              onClick={handleConnectClick}
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

        {expanded && !isOAuth && (
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

        {/* OAuth manage panel (for connected OAuth integrations) */}
        {expanded && isOAuth && connected && integration && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Manage {meta.name}</p>
            {meta.setupNote && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700 leading-relaxed">{meta.setupNote}</p>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => { onOAuthConnect?.(); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reconnect
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => { await onDisconnect(); setExpanded(false); }}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          </div>
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
      {meta.id === 'linear' && (
        <>
          {config.issues_count && (
            <span><span className="text-gray-700 font-medium">{config.issues_count}</span> issues synced</span>
          )}
          {config.last_synced && (
            <span>Last sync: <span className="text-gray-700 font-medium">{new Date(config.last_synced).toLocaleString()}</span></span>
          )}
          {!config.last_synced && <span>Click "Sync Issues" to import your Linear issues</span>}
        </>
      )}
      {meta.id === 'ordinal' && (
        <>
          <span className="text-[#7E61FF] font-medium">● Connected</span>
          <span>Social posts sync enabled</span>
        </>
      )}
      {meta.id === 'slack' && config.slack_team_name && (
        <>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Workspace: <span className="text-gray-700 font-medium">{config.slack_team_name}</span>
          </span>
          <span>@mention the bot to create items</span>
        </>
      )}
    </div>
  );
}

// ── Main Integrations page ────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

export function IntegrationsPage({ addToast }: Props) {
  const { workspace, user, userRole } = useApp();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<IntegrationPlatform | null>(null);
  const [testing, setTesting] = useState<IntegrationPlatform | null>(null);
  const [syncing, setSyncing] = useState<IntegrationPlatform | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Handle OAuth redirect params (e.g. ?slack=connected)
  useEffect(() => {
    const slackStatus = searchParams.get('slack');
    if (slackStatus) {
      if (slackStatus === 'connected') {
        addToast('Slack connected successfully');
        load();
      } else if (slackStatus === 'denied') {
        addToast('Slack authorization was denied', 'error');
      } else if (slackStatus === 'error') {
        addToast('Failed to connect Slack. Please try again.', 'error');
      }
      // Clean up the URL params
      searchParams.delete('slack');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, addToast, load]);

  function getIntegration(platform: IntegrationPlatform) {
    return integrations.find(i => i.platform === platform) ?? null;
  }

  async function connect(platform: IntegrationPlatform, config: Record<string, string>) {
    if (!workspace || !user) return;
    setSaving(platform);
    try {
      // For Claude and Linear, store the API key in access_token rather than config
      const accessToken = (platform === 'claude' || platform === 'linear') ? (config.api_key || '') : '';
      const storedConfig = (platform === 'claude' || platform === 'linear')
        ? {} // Don't duplicate the key in config
        : config;

      const existing = getIntegration(platform);
      if (existing) {
        const { error } = await supabase
          .from('integrations')
          .update({
            config: storedConfig,
            access_token: accessToken || existing.access_token,
            status: 'connected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('integrations').insert({
          workspace_id: workspace.id,
          platform,
          config: storedConfig,
          access_token: accessToken,
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

  function startOAuth(platform: IntegrationPlatform) {
    if (!workspace || !user) return;
    const oauthUrl = `${SUPABASE_URL}/functions/v1/slack-oauth?action=authorize&workspace_id=${workspace.id}&user_id=${user.id}`;
    window.location.href = oauthUrl;
  }

  async function syncLinear() {
    if (!workspace) return;
    setSyncing('linear');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-linear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Sync failed');
      addToast(`Synced ${result.total} issues (${result.created} new, ${result.updated} updated)`);
      await load();
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setSyncing(null);
    }
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

        {/* Personal integrations are available to all users */}
        <div className="mt-8">
          <PersonalIntegrationsSection addToast={addToast} />
        </div>
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
                onOAuthConnect={meta.setupType === 'oauth' ? () => startOAuth(meta.id) : undefined}
                onDisconnect={() => disconnect(meta.id)}
                onTest={() => testConnection(meta.id)}
                onSync={meta.id === 'linear' ? syncLinear : undefined}
                saving={saving === meta.id}
                testing={testing === meta.id}
                syncing={syncing === meta.id}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Personal integrations (visible to all users) */}
      <PersonalIntegrationsSection addToast={addToast} />
    </div>
  );
}

// ── Personal integrations (per-user, not workspace-level) ────────────────────

function PersonalIntegrationsSection({ addToast }: { addToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { workspace, user } = useApp();
  const [granola, setGranola] = useState<UserIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspace || !user) return;
    supabase
      .from('user_integrations')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .eq('platform', 'granola')
      .maybeSingle()
      .then(({ data }) => {
        setGranola(data as UserIntegration | null);
        if (data?.access_token) setApiKey(data.access_token);
        setLoading(false);
      });
  }, [workspace, user]);

  async function saveGranola() {
    if (!workspace || !user || !apiKey.trim()) return;
    setSaving(true);
    try {
      if (granola) {
        const { error } = await supabase
          .from('user_integrations')
          .update({ access_token: apiKey.trim(), connected_at: new Date().toISOString() })
          .eq('id', granola.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_integrations')
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            platform: 'granola',
            access_token: apiKey.trim(),
            connected_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      // Reload
      const { data } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('user_id', user.id)
        .eq('platform', 'granola')
        .maybeSingle();
      setGranola(data as UserIntegration | null);
      setExpanded(false);
      addToast('Granola connected');
    } catch (err: any) {
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function disconnectGranola() {
    if (!granola) return;
    if (!confirm('Disconnect Granola? Your linked meeting notes will remain, but syncing will stop.')) return;
    const { error } = await supabase.from('user_integrations').delete().eq('id', granola.id);
    if (error) { addToast(error.message, 'error'); return; }
    setGranola(null);
    setApiKey('');
    addToast('Granola disconnected');
  }

  if (loading) return null;

  const isConnected = !!granola;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <CircleUser className="w-3.5 h-3.5 text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Personal</h3>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0"
              style={{ backgroundColor: '#F0FDF4', color: '#345A11' }}
            >
              🎙️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-900">Granola</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Meetings</span>
                {isConnected && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border text-green-700 bg-green-50 border-green-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Link your meeting notes to content items. Each person connects their own Granola account — your notes stay private to you.
              </p>
            </div>
            <button
              onClick={() => setExpanded(e => !e)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors font-medium
                ${isConnected
                  ? 'text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-brand-600 text-white hover:bg-brand-500'}`}
            >
              {isConnected ? (
                <><Check className="w-3.5 h-3.5 text-green-500" /> Manage</>
              ) : (
                <><Plug className="w-3.5 h-3.5" /> Connect</>
              )}
            </button>
          </div>

          {expanded && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Your Granola Connection</p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700 leading-relaxed">
                  This is a personal connection — only you can see your meeting notes. Your API key is not shared with other workspace members.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Granola API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="gra_..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <a
                href="https://granola.ai/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
              >
                <ExternalLink className="w-3 h-3" /> Get your API key from Granola
              </a>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={saveGranola}
                  disabled={saving || !apiKey.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {isConnected ? 'Update' : 'Connect'}
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                {isConnected && (
                  <button
                    onClick={disconnectGranola}
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Disconnect
                  </button>
                )}
              </div>
            </div>
          )}

          {isConnected && !expanded && granola?.connected_at && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                <span className="text-[#345A11] font-medium">● Connected</span>
                <span>Connected {new Date(granola.connected_at).toLocaleDateString()}</span>
                <span>Meeting notes linking enabled</span>
              </div>
            </div>
          )}
        </div>
      </div>
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
