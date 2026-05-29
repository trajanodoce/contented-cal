import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { toast } from 'sonner';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
  X,
} from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scope: 'read' | 'read_write' | 'full';
  created_at: string;
  last_used_at: string | null;
}

interface ApiKeysTabProps {
  workspaceId: string | null;
}

// ── SHA-256 in the browser ──────────────────────────────────────────────────
async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateRawKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `cc_sk_${hex}`;
}

const SCOPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  read:       { label: 'Read only',    color: '#005D97', bg: '#005D9715' },
  read_write: { label: 'Read & Write', color: '#16a34a', bg: '#16a34a15' },
  full:       { label: 'Full access',  color: '#7c3aed', bg: '#7c3aed15' },
};

export function ApiKeysTab({ workspaceId }: ApiKeysTabProps) {
  const { currentWorkspace } = useWorkspace();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'read' | 'read_write' | 'full'>('read');
  const [creating, setCreating] = useState(false);

  // One-time key display
  const [displayKey, setDisplayKey] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirm
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Docs panel
  const [showDocs, setShowDocs] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scope, created_at, last_used_at')
      .eq('workspace_id', workspaceId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load API keys');
    } else {
      setKeys((data as ApiKey[]) || []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ── Create key ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!workspaceId || !newName.trim()) return;
    setCreating(true);

    const rawKey = generateRawKey();
    const keyHash = await sha256hex(rawKey);
    const keyPrefix = rawKey.slice(0, 12); // "cc_sk_a8f3k2"

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error('Could not determine current user');
      setCreating(false);
      return;
    }

    const { error } = await supabase.from('api_keys').insert({
      workspace_id: workspaceId,
      name: newName.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scope: newScope,
      created_by: userId,
    });

    setCreating(false);

    if (error) {
      toast.error('Failed to create API key: ' + error.message);
      return;
    }

    // Show one-time key display
    setShowCreate(false);
    setDisplayKey({ name: newName.trim(), key: rawKey });
    setNewName('');
    setNewScope('read');
    fetchKeys();
  };

  // ── Revoke key ──────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(true);
    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', revokeId);
    setRevoking(false);
    setRevokeId(null);
    if (error) {
      toast.error('Failed to revoke key');
    } else {
      toast.success('API key revoked');
      fetchKeys();
    }
  };

  // ── Copy helper ─────────────────────────────────────────────────────────
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const projectRef = import.meta.env.VITE_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '') || '<project-ref>';
  const apiBase = `https://${projectRef}.supabase.co/functions/v1/api`;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-heading text-slate-900">API Keys</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Create keys to let external tools connect to your workspace
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90"
          style={{ backgroundColor: '#005D97' }}
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* API Docs toggle */}
      <button
        onClick={() => setShowDocs(!showDocs)}
        className="flex items-center gap-2 mb-4 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        {showDocs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        API Documentation
      </button>

      {showDocs && (
        <div className="mb-6 rounded-xl p-5" style={{ border: '1px solid #00233930', background: '#F7F9FC' }}>
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-slate-900 mb-1">Base URL</p>
              <code className="block bg-slate-900 text-slate-100 rounded-lg px-4 py-2 text-xs font-mono">
                {apiBase}
              </code>
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-1">Authentication</p>
              <p className="text-slate-600 mb-2">Include your API key in the Authorization header:</p>
              <code className="block bg-slate-900 text-slate-100 rounded-lg px-4 py-2 text-xs font-mono">
                Authorization: Bearer cc_sk_your_key_here
              </code>
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-2">Endpoints</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2 pr-4 font-medium">Method</th>
                      <th className="pb-2 pr-4 font-medium">Path</th>
                      <th className="pb-2 pr-4 font-medium">Scope</th>
                      <th className="pb-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-slate-700">
                    <tr><td className="py-1 pr-4 text-green-700">GET</td><td className="pr-4">/items</td><td className="pr-4">read</td><td className="font-sans">List items (filterable)</td></tr>
                    <tr><td className="py-1 pr-4 text-green-700">GET</td><td className="pr-4">/items/:id</td><td className="pr-4">read</td><td className="font-sans">Get single item</td></tr>
                    <tr><td className="py-1 pr-4 text-blue-700">POST</td><td className="pr-4">/items</td><td className="pr-4">read_write</td><td className="font-sans">Create item</td></tr>
                    <tr><td className="py-1 pr-4 text-amber-700">PATCH</td><td className="pr-4">/items/:id</td><td className="pr-4">read_write</td><td className="font-sans">Update item</td></tr>
                    <tr><td className="py-1 pr-4 text-red-700">DELETE</td><td className="pr-4">/items/:id</td><td className="pr-4">full</td><td className="font-sans">Delete item</td></tr>
                    <tr><td className="py-1 pr-4 text-green-700">GET</td><td className="pr-4">/types</td><td className="pr-4">read</td><td className="font-sans">List content types</td></tr>
                    <tr><td className="py-1 pr-4 text-green-700">GET</td><td className="pr-4">/statuses</td><td className="pr-4">read</td><td className="font-sans">List board columns</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-1">Example: List items</p>
              <pre className="bg-slate-900 text-slate-100 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{`curl ${apiBase}/items \\
  -H "Authorization: Bearer cc_sk_your_key_here"`}</pre>
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-1">Example: Create item</p>
              <pre className="bg-slate-900 text-slate-100 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{`curl -X POST ${apiBase}/items \\
  -H "Authorization: Bearer cc_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "New blog post", "channel": "Blog"}'`}</pre>
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-1">Query filters</p>
              <p className="text-slate-600">
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">status</code>{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">content_type_id</code>{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">channel</code>{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">project_id</code>{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">priority</code>{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">assignee_id</code>{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">limit</code>{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">offset</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keys table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-slate-300 bg-surface-nested">
          <Key className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600 mb-1">No API keys yet</p>
          <p className="text-xs text-slate-400 mb-4">Create a key to let external tools access your workspace</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: '#005D97' }}
          >
            <Plus className="w-4 h-4" />
            Create API Key
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #00233930' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#005D9712' }}>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Scope</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Key</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Used</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const scopeInfo = SCOPE_LABELS[key.scope] || SCOPE_LABELS.read;
                return (
                  <tr key={key.id} className="border-t border-slate-100 hover:bg-[#005D9718] transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{key.name}</td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ color: scopeInfo.color, backgroundColor: scopeInfo.bg }}
                      >
                        <Shield className="w-3 h-3" />
                        {scopeInfo.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{key.key_prefix}...</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : <span className="text-slate-400">Never</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setRevokeId(key.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[#BA2C2C12] text-slate-400 hover:text-[#BA2C2C]"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#00233960' }}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md mx-4 p-6" style={{ border: '1px solid #00233930' }}>
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-lg font-heading text-slate-900">Create API Key</h4>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Key name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Zapier integration"
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  style={{ border: '1px solid #00233930' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Permission scope</label>
                <div className="space-y-2">
                  {(['read', 'read_write', 'full'] as const).map((s) => {
                    const info = SCOPE_LABELS[s];
                    const descriptions: Record<string, string> = {
                      read: 'Can list and read content items, types, and statuses',
                      read_write: 'Can also create and update content items',
                      full: 'Can also delete content items',
                    };
                    return (
                      <label
                        key={s}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          newScope === s ? 'ring-2 ring-brand-500' : 'hover:bg-[#005D9718]'
                        }`}
                        style={{ border: '1px solid #00233930' }}
                      >
                        <input
                          type="radio"
                          name="scope"
                          value={s}
                          checked={newScope === s}
                          onChange={() => setNewScope(s)}
                          className="mt-0.5 accent-[#005D97]"
                        />
                        <div>
                          <span className="text-sm font-semibold" style={{ color: info.color }}>{info.label}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{descriptions[s]}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                style={{ border: '1px solid #00233930' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#005D97' }}
              >
                {creating ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── One-time key display modal ───────────────────────────────────── */}
      {displayKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#00233960' }}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" style={{ border: '1px solid #00233930' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#f59e0b20' }}>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h4 className="text-lg font-heading text-slate-900">Save your API key</h4>
                <p className="text-sm text-slate-500">You won't be able to see it again</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">{displayKey.name}</p>
              <div
                className="flex items-center gap-2 p-3 rounded-lg font-mono text-sm break-all"
                style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}
              >
                <span className="flex-1 select-all">{displayKey.key}</span>
                <button
                  onClick={() => copyToClipboard(displayKey.key)}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-white/10 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => { setDisplayKey(null); setCopied(false); }}
              className="w-full px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: '#005D97' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Revoke confirmation modal ────────────────────────────────────── */}
      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#00233960' }}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" style={{ border: '1px solid #00233930' }}>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="p-3 rounded-full mb-3" style={{ backgroundColor: '#BA2C2C12' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: '#BA2C2C' }} />
              </div>
              <h4 className="text-lg font-heading text-slate-900">Revoke API Key</h4>
              <p className="text-sm text-slate-500 mt-1">
                Any integrations using this key will immediately stop working. This can't be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                style={{ border: '1px solid #00233930' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#BA2C2C' }}
              >
                {revoking ? 'Revoking...' : 'Revoke Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
