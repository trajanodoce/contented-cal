import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, X, Loader2, Check, Mail, Shield, Eye, Edit3, Crown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { WorkspaceInvite } from '../../lib/database.types';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ROLE_META: Record<string, { label: string; icon: React.ElementType; description: string; color: string }> = {
  admin: { label: 'Admin', icon: Crown, description: 'Full access including settings and team management', color: 'text-amber-600 bg-amber-50' },
  editor: { label: 'Editor', icon: Edit3, description: 'Create and edit content, cannot access settings', color: 'text-brand-600 bg-mint' },
  viewer: { label: 'Viewer', icon: Eye, description: 'Read-only access, can add comments', color: 'text-gray-600 bg-gray-100' },
};

export function TeamSettings({ addToast }: Props) {
  const { workspace, members, user, userRole, refreshWorkspaceData } = useApp();
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  const loadInvites = useCallback(async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspace.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    if (data) setInvites(data);
  }, [workspace]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !user || !inviteEmail.trim()) return;
    setInviting(true);

    // Check if already a member
    const alreadyMember = members.some(m => m.email === inviteEmail.trim());
    if (alreadyMember) {
      addToast('This person is already a workspace member', 'error');
      setInviting(false);
      return;
    }

    const { error } = await supabase.from('workspace_invites').insert({
      workspace_id: workspace.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user.id,
    });

    setInviting(false);
    if (error) { addToast(error.message, 'error'); return; }

    setInviteEmail('');
    setShowInvite(false);
    await loadInvites();
    addToast(`Invite sent to ${inviteEmail.trim()}`);
  }

  async function revokeInvite(id: string) {
    const { error } = await supabase.from('workspace_invites').delete().eq('id', id);
    if (error) { addToast(error.message, 'error'); return; }
    await loadInvites();
    addToast('Invite revoked');
  }

  async function changeRole(userId: string, role: 'admin' | 'editor' | 'viewer') {
    if (!workspace) return;
    setChangingRole(userId);
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspace.id)
      .eq('user_id', userId);
    setChangingRole(null);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    addToast('Role updated');
  }

  async function removeMember(userId: string) {
    if (!workspace) return;
    if (!confirm('Remove this member from the workspace?')) return;
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('user_id', userId);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    addToast('Member removed');
  }

  return (
    <div className="max-w-3xl p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold text-gray-900">Team</h2>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 transition-colors"
          >
            <Plus className="w-4 h-4" /> Invite member
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">Manage who has access to this workspace and their permissions.</p>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Object.entries(ROLE_META).map(([role, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={role} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 ${meta.color}`}>
                <Icon className="w-3 h-3" />
                {meta.label}
              </div>
              <p className="text-xs text-gray-500">{meta.description}</p>
            </div>
          );
        })}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-mint border border-brand-100 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-500" /> Invite new member
          </h3>
          <form onSubmit={sendInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
              <input
                autoFocus
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as typeof inviteRole)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-60 flex items-center gap-1.5"
            >
              {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Send invite
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="p-2 text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">An invite link will be generated. Share it with the recipient to give them access.</p>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Members ({members.length})</span>
        </div>
        <div className="divide-y divide-gray-50">
          {members.map(member => {
            const isCurrentUser = member.user_id === user?.id;
            const roleMeta = ROLE_META[member.role];
            const Icon = roleMeta?.icon ?? Shield;
            return (
              <div key={member.user_id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-brand-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    (member.full_name ?? member.email ?? 'U').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {member.full_name ?? member.email?.split('@')[0] ?? 'Unknown'}
                    {isCurrentUser && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                  </p>
                  {member.email && <p className="text-xs text-gray-400 truncate">{member.email}</p>}
                </div>
                {isAdmin && !isCurrentUser ? (
                  <div className="flex items-center gap-2">
                    {changingRole === member.user_id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <select
                        value={member.role}
                        onChange={e => changeRole(member.user_id, e.target.value as 'admin' | 'editor' | 'viewer')}
                        className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none text-gray-600"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}
                    <button
                      onClick={() => removeMember(member.user_id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleMeta?.color ?? 'bg-gray-100 text-gray-500'}`}>
                    <Icon className="w-3 h-3" />
                    {roleMeta?.label ?? member.role}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Pending invites ({invites.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{invite.email}</p>
                  <p className="text-xs text-gray-400">Invite pending · {invite.role}</p>
                </div>
                {/* Invite link copy */}
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/accept-invite/${invite.token}`;
                    navigator.clipboard.writeText(link);
                    addToast('Invite link copied');
                  }}
                  className="text-xs text-brand-500 hover:text-brand-700 border border-brand-100 px-2 py-1 rounded-lg"
                >
                  Copy link
                </button>
                {isAdmin && (
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Revoke invite"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
