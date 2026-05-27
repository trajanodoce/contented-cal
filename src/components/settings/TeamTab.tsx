import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { Profile, WorkspaceInvite } from '../../lib/database.types';
import {
  User,
  UserPlus,
  ChevronDown,
  Check,
  Trash2,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Eye,
  Loader2,
  Mail,
  X,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

type Role = 'admin' | 'editor' | 'viewer';

interface TeamMember {
  user_id: string;
  role: Role;
  created_at: string;
  profile: Profile;
}

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  admin: { label: 'Admin', color: 'text-purple-700', bg: 'bg-purple-100', icon: ShieldCheck },
  editor: { label: 'Editor', color: 'text-blue-700', bg: 'bg-blue-100', icon: Shield },
  viewer: { label: 'Viewer', color: 'text-slate-600', bg: 'bg-slate-100', icon: Eye },
};

export function TeamTab() {
  const { currentWorkspace, userRole } = useWorkspace();
  const { user } = useAuth();
  const { refreshWorkspaceData } = useApp();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('user_id, role, created_at, profiles:user_id(id, full_name, email, avatar_url)')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at'),
      supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);

    if (membersRes.error) {
      toast.error('Failed to load team members');
    } else {
      const mapped = (membersRes.data || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role as Role,
        created_at: m.created_at,
        profile: m.profiles as Profile,
      }));
      setMembers(mapped);
    }

    if (!invitesRes.error) {
      setPendingInvites(invitesRes.data || []);
    }

    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleCancelInvite = async (inviteId: string) => {
    setCancellingInviteId(inviteId);
    const { error } = await supabase
      .from('workspace_invites')
      .delete()
      .eq('id', inviteId);

    if (error) {
      toast.error('Failed to cancel invite');
    } else {
      toast.success('Invite cancelled');
      fetchMembers();
    }
    setCancellingInviteId(null);
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    if (!currentWorkspace) return;
    setChangingRoleId(userId);

    const { error } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update role: ' + error.message);
    } else {
      toast.success('Role updated');
      fetchMembers();
      refreshWorkspaceData();
    }
    setChangingRoleId(null);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentWorkspace) return;

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to remove member: ' + error.message);
    } else {
      toast.success('Member removed');
      fetchMembers();
      refreshWorkspaceData();
    }
    setRemovingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Team Members</h3>
          <p className="text-sm text-slate-500 mt-1">{members.length} member{members.length !== 1 ? 's' : ''} in this workspace</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-amber-800 flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4" />
            Pending Invites ({pendingInvites.length})
          </h4>
          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const roleConfig = ROLE_CONFIG[invite.role as Role] ?? ROLE_CONFIG.viewer;
              return (
                <div key={invite.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-amber-200/60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                      <p className="text-xs text-slate-500">
                        <span className={`${roleConfig.color}`}>{roleConfig.label}</span>
                        {' · Invited '}
                        {format(new Date(invite.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      disabled={cancellingInviteId === invite.id}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel invite"
                    >
                      {cancellingInviteId === invite.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Member</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Joined</th>
              {isAdmin && (
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              const roleConfig = ROLE_CONFIG[member.role];

              return (
                <tr
                  key={member.user_id}
                  className={`${isCurrentUser ? 'bg-blue-50/50' : 'hover:bg-slate-50'} transition-colors`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {member.profile.avatar_url ? (
                        <img
                          src={member.profile.avatar_url}
                          alt={member.profile.full_name || ''}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {member.profile.full_name || 'Unnamed'}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-blue-600 font-normal">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{member.profile.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && !isCurrentUser ? (
                      <RoleDropdown
                        currentRole={member.role}
                        loading={changingRoleId === member.user_id}
                        onChange={(role) => handleRoleChange(member.user_id, role)}
                      />
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleConfig.bg} ${roleConfig.color}`}>
                        <roleConfig.icon className="w-3 h-3" />
                        {roleConfig.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-500">
                      {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {!isCurrentUser && (
                        <button
                          onClick={() => setRemovingId(member.user_id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && currentWorkspace && (
        <InviteModal
          workspaceId={currentWorkspace.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={fetchMembers}
        />
      )}

      {/* Remove Confirmation */}
      {removingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setRemovingId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Remove Team Member?</h3>
            </div>
            <p className="text-slate-600 mb-6">
              This person will lose access to this workspace. They can be re-invited later.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRemovingId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => removingId && handleRemoveMember(removingId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleDropdown({ currentRole, loading, onChange }: { currentRole: Role; loading: boolean; onChange: (role: Role) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const roleConfig = ROLE_CONFIG[currentRole];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleConfig.bg} ${roleConfig.color} hover:opacity-80 transition-opacity`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <roleConfig.icon className="w-3 h-3" />
        )}
        {roleConfig.label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[140px]">
            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, config]) => (
              <button
                key={role}
                onClick={() => {
                  setIsOpen(false);
                  if (role !== currentRole) onChange(role);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                  role === currentRole ? 'bg-blue-50' : ''
                }`}
              >
                <config.icon className="w-3.5 h-3.5 text-slate-500" />
                <span className={role === currentRole ? 'text-blue-900 font-medium' : 'text-slate-700'}>
                  {config.label}
                </span>
                {role === currentRole && <Check className="w-4 h-4 ml-auto text-blue-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InviteModal({ workspaceId, onClose, onInvited }: { workspaceId: string; onClose: () => void; onInvited: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleInvite = async () => {
    if (!email.trim() || !user) return;
    setSending(true);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    // Check if invite already pending
    const { data: existingInvite } = await supabase
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .maybeSingle();

    if (existingInvite) {
      setMessage({ type: 'error', text: 'An invite has already been sent to this email.' });
      setSending(false);
      return;
    }

    // Check if user already has an account
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profile) {
      // Check if already a member
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        setMessage({ type: 'error', text: 'This user is already a member of this workspace.' });
        setSending(false);
        return;
      }

      // User exists — add them directly and mark invite as accepted
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: workspaceId, user_id: profile.id, role });

      if (memberError) {
        setMessage({ type: 'error', text: 'Failed to add member: ' + memberError.message });
        setSending(false);
        return;
      }

      // Create invite record as already accepted
      await supabase.from('workspace_invites').insert({
        workspace_id: workspaceId,
        email: normalizedEmail,
        role,
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      });

      toast.success(`${profile.full_name || profile.email} added as ${role}`);
      onInvited();
      onClose();
    } else {
      // User doesn't exist yet — create pending invite
      const { error: inviteError } = await supabase
        .from('workspace_invites')
        .insert({
          workspace_id: workspaceId,
          email: normalizedEmail,
          role,
          invited_by: user.id,
        });

      if (inviteError) {
        setMessage({ type: 'error', text: 'Failed to send invite: ' + inviteError.message });
      } else {
        toast.success(`Invite sent to ${normalizedEmail}`);
        onInvited();
        onClose();
      }
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Invite Team Member</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="colleague@company.com"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="editor">Editor — can create, edit, and manage content</option>
              <option value="admin">Admin — full access including settings</option>
              <option value="viewer">Viewer — read-only access, can comment</option>
            </select>
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : message.type === 'info'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={sending || !email.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
