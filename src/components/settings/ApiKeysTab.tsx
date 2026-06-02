import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  Key,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  PenLine,
  Circle,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { EmptyState } from '../ui/EmptyState';
import { formatRelativeTime } from '../../lib/relativeTime';

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

type Scope = 'read' | 'read_write' | 'full';

const SCOPE_CHIP: Record<Scope, { label: string; bg: string; color: string; border: string }> = {
  read:       { label: 'Read only',   bg: '#94A3B820', color: '#475569', border: '#94A3B840' },
  read_write: { label: 'Read+Write',  bg: '#005D9712', color: '#005D97', border: '#005D9730' },
  full:       { label: 'Full admin',  bg: '#BA2C2C15', color: '#BA2C2C', border: '#BA2C2C30' },
};

// Format key preview as cc_sk_{first4}…
// The stored key_prefix is the first 12 chars of the raw key, e.g. "cc_sk_a8f3k2"
function formatKeyPreview(prefix: string): string {
  return `${prefix}…`;
}

export function ApiKeysTab({ workspaceId }: ApiKeysTabProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<Scope>('read');
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
          <h3 className="text-lg font-heading" style={{ color: '#002339' }}>API Keys</h3>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            Create keys to let external tools connect to your workspace
          </p>
        </div>
        {keys.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: 'white',
              background: '#005D97',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            + Create API key
          </button>
        )}
      </div>

      {/* API Docs toggle */}
      <button
        onClick={() => setShowDocs(!showDocs)}
        className="flex items-center gap-2 mb-4 text-sm font-medium transition-colors"
        style={{ color: '#475569' }}
      >
        {showDocs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        API Documentation
      </button>

      {showDocs && (
        <div className="mb-6 rounded-xl p-5" style={{ border: '1px solid #00233930', background: '#F7F9FC' }}>
          <div className="space-y-4 text-sm" style={{ color: '#475569' }}>
            <div>
              <p className="font-semibold mb-1" style={{ color: '#002339' }}>Base URL</p>
              <code className="block rounded-lg px-4 py-2 text-xs font-mono" style={{ background: '#002339', color: '#c8dde8' }}>
                {apiBase}
              </code>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: '#002339' }}>Authentication</p>
              <p className="mb-2" style={{ color: '#64748b' }}>Include your API key in the Authorization header:</p>
              <code className="block rounded-lg px-4 py-2 text-xs font-mono" style={{ background: '#002339', color: '#c8dde8' }}>
                Authorization: Bearer cc_sk_your_key_here
              </code>
            </div>
            <div>
              <p className="font-semibold mb-2" style={{ color: '#002339' }}>Endpoints</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left" style={{ color: '#64748b' }}>
                      <th className="pb-2 pr-4 font-medium">Method</th>
                      <th className="pb-2 pr-4 font-medium">Path</th>
                      <th className="pb-2 pr-4 font-medium">Scope</th>
                      <th className="pb-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono" style={{ color: '#475569' }}>
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
              <p className="font-semibold mb-1" style={{ color: '#002339' }}>Example: List items</p>
              <pre className="rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre" style={{ background: '#002339', color: '#c8dde8' }}>{`curl ${apiBase}/items \\
  -H "Authorization: Bearer cc_sk_your_key_here"`}</pre>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: '#002339' }}>Example: Create item</p>
              <pre className="rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre" style={{ background: '#002339', color: '#c8dde8' }}>{`curl -X POST ${apiBase}/items \\
  -H "Authorization: Bearer cc_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "New blog post", "channel": "Blog"}'`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ── Body: loading / empty / table ────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 rounded-full" style={{ borderColor: '#005D97', borderTopColor: 'transparent' }} />
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          level={1}
          state="info"
          icon={<Key size={22} strokeWidth={2} />}
          title="No API keys"
          description="Create a key to give external apps access to your ContentedCal workspace."
          action={{ label: '+ Create API key', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div
          style={{
            background: 'white',
            border: '1px solid #00233930',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1.8fr 110px 110px 130px 90px',
              gap: 12,
              padding: '10px 16px',
              background: '#F7F9FC',
              borderBottom: '1px solid #00233918',
              fontSize: 10,
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <div>Name</div>
            <div>Key</div>
            <div>Scope</div>
            <div>Created</div>
            <div>Last used</div>
            <div />
          </div>

          {/* Body rows */}
          {keys.map((key, idx) => {
            const chip = SCOPE_CHIP[key.scope] || SCOPE_CHIP.read;
            const isLast = idx === keys.length - 1;
            return (
              <div
                key={key.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1.8fr 110px 110px 130px 90px',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: isLast ? 'none' : '1px solid #00233918',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <div style={{ color: '#002339', fontWeight: 500 }}>{key.name}</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', color: '#64748b' }}>
                  {formatKeyPreview(key.key_prefix)}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 99,
                    background: chip.bg,
                    color: chip.color,
                    border: `1px solid ${chip.border}`,
                    justifySelf: 'start',
                  }}
                >
                  {chip.label}
                </span>
                <div style={{ color: '#64748b' }}>{formatRelativeTime(key.created_at)}</div>
                <div style={{ color: key.last_used_at ? '#64748b' : '#94a3b8' }}>
                  {key.last_used_at ? formatRelativeTime(key.last_used_at) : 'Never'}
                </div>
                <button
                  onClick={() => setRevokeId(key.id)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#BA2C2C',
                    background: 'transparent',
                    border: '1px solid #BA2C2C30',
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    justifySelf: 'end',
                  }}
                >
                  Revoke
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,35,57,0.5)' }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'white',
              border: '1.5px solid #002339',
              borderRadius: 14,
              boxShadow: '0 6px 10px rgba(0,35,57,0.14), 0 20px 32px -8px rgba(0,35,57,0.22)',
              padding: 22,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                style={{
                  fontFamily: "'Faune-Text_Bold', serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#002339',
                }}
              >
                Create API key
              </div>
              <button
                onClick={() => setShowCreate(false)}
                aria-label="Close"
                style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Key name field */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}
              >
                Key name
              </div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Mobile app — production"
                autoFocus
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  fontSize: 13,
                  color: '#334155',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                A human-readable label. Doesn't affect permissions.
              </div>
            </div>

            {/* Scope radio cards */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                Scope
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ScopeRadioCard
                  selected={newScope === 'read'}
                  onSelect={() => setNewScope('read')}
                  icon={<Eye size={13} strokeWidth={2} color="#64748b" />}
                  label="Read"
                  description="List items, fetch single items, list types and statuses. No writes."
                />
                <ScopeRadioCard
                  selected={newScope === 'read_write'}
                  onSelect={() => setNewScope('read_write')}
                  icon={<PenLine size={13} strokeWidth={2} color="#005D97" />}
                  label="Read & Write"
                  description="Everything in Read, plus create, update, and delete items."
                />
                <ScopeRadioCard
                  selected={newScope === 'full'}
                  onSelect={() => setNewScope('full')}
                  icon={<Circle size={13} strokeWidth={2} color="#BA2C2C" />}
                  label="Full admin"
                  description="Everything above, plus workspace settings, members, and API key management."
                  sensitive
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#475569',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'white',
                  background: '#005D97',
                  border: 'none',
                  borderRadius: 8,
                  cursor: !newName.trim() || creating ? 'not-allowed' : 'pointer',
                  opacity: !newName.trim() || creating ? 0.5 : 1,
                }}
              >
                {creating ? 'Creating…' : 'Create key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── One-time reveal modal ────────────────────────────────────────── */}
      {displayKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,35,57,0.5)' }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'white',
              border: '1.5px solid #002339',
              borderRadius: 14,
              boxShadow: '0 6px 10px rgba(0,35,57,0.14), 0 20px 32px -8px rgba(0,35,57,0.22)',
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #92D1B228 0%, #FBE7F140 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={18} strokeWidth={2.5} color="#357254" />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "'Faune-Text_Bold', serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#002339',
                    marginBottom: 2,
                  }}
                >
                  Key created
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                  Copy this key and store it somewhere safe.{' '}
                  <strong style={{ color: '#BA2C2C' }}>It won't be shown again.</strong>
                </div>
              </div>
            </div>

            {/* Dark monospace key box */}
            <div
              style={{
                background: '#002339',
                color: '#c8dde8',
                padding: '12px 14px',
                borderRadius: 8,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span style={{ overflowX: 'auto', whiteSpace: 'nowrap', flex: 1 }} className="select-all">
                {displayKey.key}
              </span>
              <button
                onClick={() => copyToClipboard(displayKey.key)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#c8dde8',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setDisplayKey(null);
                  setCopied(false);
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'white',
                  background: '#005D97',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Done — I've saved it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke confirmation modal ────────────────────────────────────── */}
      <ConfirmModal
        open={revokeId !== null}
        onClose={() => setRevokeId(null)}
        onConfirm={handleRevoke}
        variant="destructive"
        icon={<Trash2 className="w-5 h-5" style={{ color: '#BA2C2C' }} />}
        title="Revoke API Key"
        description="Any integrations using this key will immediately stop working. This can't be undone."
        confirmLabel="Revoke key"
        loading={revoking}
      />
    </div>
  );
}

// ── Scope radio card ─────────────────────────────────────────────────────
interface ScopeRadioCardProps {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  sensitive?: boolean;
}

function ScopeRadioCard({ selected, onSelect, icon, label, description, sensitive }: ScopeRadioCardProps) {
  return (
    <label
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        background: selected ? '#005D9708' : 'white',
        border: selected ? '1.5px solid #005D97' : '1px solid #cbd5e1',
        borderRadius: 10,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 14,
          height: 14,
          border: `1.5px solid ${selected ? '#005D97' : '#cbd5e1'}`,
          borderRadius: '50%',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {selected && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#005D97',
            }}
          />
        )}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#002339' }}>{label}</span>
          {sensitive && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 99,
                background: '#BA2C2C15',
                color: '#BA2C2C',
                border: '1px solid #BA2C2C30',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Sensitive
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{description}</div>
      </div>
    </label>
  );
}
