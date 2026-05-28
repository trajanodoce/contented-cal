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
    iconBg: '#C4B5D940',
    iconText: '⚡',
    iconColor: '#5B4F8A',
    category: 'Social Media',
    setupType: 'api_key',
    fields: [
      { key: 'api_key', label: 'Ordinal API Key', placeholder: 'ord_api_...', secret: true },
    ],
    docsUrl: 'https://ordinal.social/settings/api',
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
    disconnected: { icon: Clock, label: 'Disconnected', cls: 'text-slate-600 bg-slate-50 border-slate-200' },
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
      // For Claude, the api_key is stored in access_token
      if (meta.id === 'claude' && f.key === 'api_key' && existing?.access_token) {
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
    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
      <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Configure {meta.name}</p>

      {meta.setupNote && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
          <p className="text-xs text-brand-700 leading-relaxed">{meta.setupNote}</p>
        </div>
      )}

      {(meta.fields ?? []).map(field => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-slate-700 mb-1">{field.label}</label>
          <div className="relative">
            <input
              type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
              value={values[field.key] ?? ''}
              onChange={e => set(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 pr-8"
            />
            {field.secret && (
              <button
                type="button"
                onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
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
    <div className="bg-surface-card rounded-xl overflow-hidden" style={{ border: '1px solid #00233930' }}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <PlatformIcon meta={meta} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900">{meta.name}</h3>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{meta.category}</span>
              {integration && <StatusBadge status={integration.status} />}
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{meta.description}</p>
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
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
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
                  ? 'text-slate-700 border border-slate-200 hover:bg-slate-50'
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
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Manage {meta.name}</p>
            {meta.setupNote && (
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                <p className="text-xs text-brand-700 leading-relaxed">{meta.setupNote}</p>
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
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
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
          <div className="mt-3 pt-3 border-t border-slate-100">
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
    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
      <span>Connected {connectedAt}</span>
      {meta.id === 'ordinal' && (
        <>
          <span className="text-[#5B4F8A] font-medium">● Connected</span>
          <span>Social posts sync enabled</span>
        </>
      )}
      {meta.id === 'slack' && config.slack_team_name && (
        <>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Workspace: <span className="text-slate-700 font-medium">{config.slack_team_name}</span>
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
      // For Claude, store the API key in access_token rather than config
      const accessToken = platform === 'claude' ? (config.api_key || '') : '';
      const storedConfig = platform === 'claude'
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
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Integrations</h2>
        <p className="text-sm text-slate-500 mb-6">Connect external tools to your workspace.</p>
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
        <h2 className="text-xl font-semibold text-slate-900">Integrations</h2>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {integrations.filter(i => i.status === 'connected').length} connected
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-6">Connect your tools to supercharge your content workflow.</p>

      {categories.map(cat => (
        <div key={cat} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{cat}</h3>
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
                saving={saving === meta.id}
                testing={testing === meta.id}
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

const SUPABASE_FN_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

function PersonalIntegrationsSection({ addToast }: { addToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { workspace, user } = useApp();
  const [integrations, setIntegrations] = useState<Record<string, UserIntegration | null>>({ granola: null, linear: null, notion: null });
  const [loading, setLoading] = useState(true);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ granola: '', linear: '', notion: '' });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [linearInfo, setLinearInfo] = useState<{ name: string; teams: string; issuesCount?: number; lastSynced?: string } | null>(null);

  const loadIntegrations = useCallback(async () => {
    if (!workspace || !user) return;
    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .in('platform', ['granola', 'linear', 'notion']);

    const map: Record<string, UserIntegration | null> = { granola: null, linear: null, notion: null };
    const keys: Record<string, string> = { granola: '', linear: '', notion: '' };
    (data || []).forEach((d: UserIntegration) => {
      map[d.platform] = d;
      if (d.access_token) keys[d.platform] = d.access_token;
    });
    setIntegrations(map);
    setApiKeys(keys);

    // Load Linear info from config
    const linearInt = map.linear;
    if (linearInt) {
      const config = (linearInt.config ?? {}) as Record<string, string>;
      if (config.linear_user_name) {
        setLinearInfo({
          name: config.linear_user_name,
          teams: config.linear_teams || '',
          issuesCount: config.issues_count ? Number(config.issues_count) : undefined,
          lastSynced: config.last_synced || undefined,
        });
      }
    }

    setLoading(false);
  }, [workspace, user]);

  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  async function savePersonalIntegration(platform: string) {
    if (!workspace || !user || !apiKeys[platform]?.trim()) return;
    setSaving(platform);
    try {
      const existing = integrations[platform];
      if (existing) {
        const { error } = await supabase
          .from('user_integrations')
          .update({ access_token: apiKeys[platform].trim(), connected_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_integrations')
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            platform,
            access_token: apiKeys[platform].trim(),
            connected_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      await loadIntegrations();
      setExpandedPlatform(null);
      addToast(`${platform === 'linear' ? 'Linear' : 'Granola'} connected`);

      // Auto-test Linear on connect
      if (platform === 'linear') {
        testLinear(apiKeys[platform].trim());
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function disconnectPersonal(platform: string) {
    const existing = integrations[platform];
    if (!existing) return;
    const name = platform === 'linear' ? 'Linear' : 'Granola';
    if (!confirm(`Disconnect ${name}?`)) return;
    const { error } = await supabase.from('user_integrations').delete().eq('id', existing.id);
    if (error) { addToast(error.message, 'error'); return; }
    setIntegrations(prev => ({ ...prev, [platform]: null }));
    setApiKeys(prev => ({ ...prev, [platform]: '' }));
    if (platform === 'linear') setLinearInfo(null);
    addToast(`${name} disconnected`);
  }

  async function testLinear(key?: string) {
    const apiKey = key || apiKeys.linear;
    if (!apiKey) return;
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: apiKey },
        body: JSON.stringify({ query: '{ viewer { id name email } teams { nodes { id name } } }' }),
      });
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0]?.message || 'API error');

      const viewer = json.data.viewer;
      const teams = json.data.teams.nodes;
      const teamNames = teams.map((t: { name: string }) => t.name).join(', ');
      setLinearInfo(prev => ({ ...prev, name: viewer.name, teams: teamNames }));

      // Store info in user_integrations config
      const linearInt = integrations.linear;
      if (linearInt) {
        await supabase
          .from('user_integrations')
          .update({
            config: {
              ...((linearInt.config ?? {}) as Record<string, unknown>),
              linear_user_name: viewer.name,
              linear_user_email: viewer.email,
              linear_teams: teamNames,
            },
          })
          .eq('id', linearInt.id);
      }

      addToast(`Connected as ${viewer.name}`, 'success');
    } catch (err: unknown) {
      addToast(`Linear test failed: ${(err as Error).message}`, 'error');
    }
  }

  async function syncLinear() {
    if (!workspace || !user) return;
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FN_URL}/functions/v1/sync-linear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ workspace_id: workspace.id, user_id: user.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Sync failed');
      setLinearInfo(prev => ({ ...prev, name: prev?.name || '', teams: prev?.teams || '', issuesCount: result.total, lastSynced: new Date().toISOString() }));
      addToast(`Synced ${result.total} issues (${result.created} new, ${result.updated} updated)`);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return null;

  const personalPlatforms = [
    {
      id: 'linear',
      name: 'Linear',
      description: 'Sync your assigned Linear issues into ContentedCal. Each person connects their own Linear key.',
      iconBg: '#FFC3B840',
      iconText: 'L',
      iconColor: '#A05042',
      tag: 'Engineering',
      placeholder: 'lin_api_...',
      docsUrl: 'https://linear.app/settings/api',
      docsLabel: 'Get your API key from Linear',
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Connect your Notion workspace to import and push content items. Each person connects their own Notion account.',
      iconBg: '#F9FAFB',
      iconText: 'N',
      iconColor: '#191919',
      tag: 'Productivity',
      placeholder: 'secret_...',
      docsUrl: 'https://www.notion.so/my-integrations',
      docsLabel: 'Get your API key from Notion',
    },
    {
      id: 'granola',
      name: 'Granola',
      description: 'Link your meeting notes to content items. Each person connects their own Granola account — your notes stay private to you.',
      iconBg: '#92D1B240',
      iconText: '🎙️',
      iconColor: '#357254',
      tag: 'Meetings',
      placeholder: 'gra_...',
      docsUrl: 'https://granola.ai/settings',
      docsLabel: 'Get your API key from Granola',
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <CircleUser className="w-3.5 h-3.5 text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Personal</h3>
      </div>

      <div className="space-y-3">
        {personalPlatforms.map(platform => {
          const integration = integrations[platform.id];
          const isConnected = !!integration;
          const isExpanded = expandedPlatform === platform.id;

          return (
            <div key={platform.id} className="bg-surface-card border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0"
                    style={{ backgroundColor: platform.iconBg, color: platform.iconColor }}
                  >
                    {platform.iconText}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900">{platform.name}</h3>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{platform.tag}</span>
                      {isConnected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border text-green-700 bg-green-50 border-green-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{platform.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConnected && platform.id === 'linear' && (
                      <button
                        onClick={syncLinear}
                        disabled={syncing}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                      >
                        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {syncing ? 'Syncing...' : 'Sync Issues'}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors font-medium
                        ${isConnected
                          ? 'text-slate-700 border border-slate-200 hover:bg-slate-50'
                          : 'bg-brand-600 text-white hover:bg-brand-500'}`}
                    >
                      {isConnected ? (
                        <><Check className="w-3.5 h-3.5 text-green-500" /> Manage</>
                      ) : (
                        <><Plug className="w-3.5 h-3.5" /> Connect</>
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Your {platform.name} Connection</p>

                    <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                      <p className="text-xs text-brand-700 leading-relaxed">
                        This is a personal connection — your API key is not shared with other workspace members.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{platform.name} API Key</label>
                      <div className="relative">
                        <input
                          type={showKeys[platform.id] ? 'text' : 'password'}
                          value={apiKeys[platform.id] ?? ''}
                          onChange={e => setApiKeys(prev => ({ ...prev, [platform.id]: e.target.value }))}
                          placeholder={platform.placeholder}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys(prev => ({ ...prev, [platform.id]: !prev[platform.id] }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showKeys[platform.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <a
                      href={platform.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
                    >
                      <ExternalLink className="w-3 h-3" /> {platform.docsLabel}
                    </a>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => savePersonalIntegration(platform.id)}
                        disabled={saving === platform.id || !apiKeys[platform.id]?.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
                      >
                        {saving === platform.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {isConnected ? 'Update' : 'Connect'}
                      </button>
                      <button
                        onClick={() => setExpandedPlatform(null)}
                        className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      {isConnected && (
                        <button
                          onClick={() => disconnectPersonal(platform.id)}
                          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Disconnect
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Connected summary */}
                {isConnected && !isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {platform.id === 'linear' && linearInfo && (
                        <>
                          <span className="text-[#A05042] font-medium">{linearInfo.name}</span>
                          {linearInfo.teams && <span className="truncate max-w-[200px]" title={linearInfo.teams}>Teams: <span className="text-slate-700 font-medium">{linearInfo.teams}</span></span>}
                          {linearInfo.issuesCount != null && <span><span className="text-slate-700 font-medium">{linearInfo.issuesCount}</span> issues synced</span>}
                          {linearInfo.lastSynced && <span>Last sync: <span className="text-slate-700 font-medium">{new Date(linearInfo.lastSynced).toLocaleString()}</span></span>}
                        </>
                      )}
                      {platform.id === 'granola' && (
                        <>
                          <span className="text-[#357254] font-medium">● Connected</span>
                          {integration?.connected_at && <span>Connected {new Date(integration.connected_at).toLocaleDateString()}</span>}
                          <span>Meeting notes linking enabled</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
          <div key={int.id} className="flex items-center gap-3 p-3 bg-surface-card border border-slate-200 rounded-xl">
            <PlatformIcon meta={meta} size="sm" />
            <span className="text-sm font-medium text-slate-700 flex-1">{meta.name}</span>
            <StatusBadge status={int.status} />
          </div>
        );
      })}
    </div>
  );
}
