import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { StyledSelect } from '../ui/StyledSelect';
import { toast } from 'sonner';
import type { Profile, WorkspaceInvite, WorkspaceRole } from '../../lib/database.types';
import {
  UserPlus,
  UserCheck,
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
  Search,
  Crown,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { format } from 'date-fns';

type Role = WorkspaceRole;

interface TeamMember {
  user_id: string;
  role: Role;
  created_at: string;
  profile: Profile;
}

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  admin: { label: 'Admin', color: 'text-purple-700', bg: 'bg-purple-100', icon: ShieldCheck },
  editor: { label: 'Editor', color: 'text-brand-700', bg: 'bg-brand-100', icon: Shield },
  viewer: { label: 'Viewer', color: 'text-slate-600', bg: 'bg-brand-600/[0.071]', icon: Eye },
};

export function TeamTab() {
  const { currentWorkspace, userRole, isOwner } = useWorkspace();
  const { user } = useAuth();
  const { refreshWorkspaceData } = useApp();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [pendingLogins, setPendingLogins] = useState<Profile[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [togglingOwnerId, setTogglingOwnerId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';
  const ownerCount = members.filter((m) => m.profile?.is_owner).length;

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    const [membersRes, invitesRes, profilesRes] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('user_id, role, created_at, profiles:user_id(id, full_name, email, avatar_url, is_owner)')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at'),
      supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .order('email'),
    ]);

    let memberIds = new Set<string>();
    if (membersRes.error) {
      toast.error('Failed to load team members');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join returns dynamic shape
      const mapped = (membersRes.data || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role as Role,
        created_at: m.created_at,
        profile: m.profiles as Profile,
      }));
      setMembers(mapped);
      memberIds = new Set(mapped.map((m) => m.user_id));
    }

    if (!invitesRes.error) {
      setPendingInvites(invitesRes.data || []);
    }

    // "New logins" — anyone who has signed in (so a profile exists) but isn't a member yet.
    // Exclude throwaway @test.local fixtures so the list stays real.
    if (!profilesRes.error) {
      const pending = (profilesRes.data || []).filter(
        (p) => !memberIds.has(p.id) && !(p.email || '').toLowerCase().endsWith('@test.local')
      );
      setPendingLogins(pending);
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

  const handleApprove = async (userId: string, role: Role) => {
    if (!currentWorkspace) return;
    setApprovingId(userId);
    const { error } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: currentWorkspace.id, user_id: userId, role });

    if (error) {
      toast.error('Failed to approve: ' + error.message);
    } else {
      toast.success('Approved — added to the workspace');
      fetchMembers();
      refreshWorkspaceData();
    }
    setApprovingId(null);
  };

  // Owner-management: grant/revoke the GLOBAL owner flag (owner-only UI; the DB
  // guard trigger blocks self-escalation and last-owner removal as a backstop).
  const handleToggleOwner = async (userId: string, makeOwner: boolean) => {
    setTogglingOwnerId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_owner: makeOwner })
      .eq('id', userId);
    if (error) {
      toast.error(
        error.message.includes('last remaining owner')
          ? 'Cannot remove the last remaining owner.'
          : 'Failed to update owner: ' + error.message
      );
    } else {
      toast.success(makeOwner ? 'Owner granted' : 'Owner removed');
      fetchMembers();
    }
    setTogglingOwnerId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              Add Member
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          </div>
        )}
      </div>

      {/* New logins - pending approval */}
      {isAdmin && pendingLogins.length > 0 && (
        <div
          className="border rounded-lg p-4"
          style={{ borderColor: 'rgb(var(--color-brand-600) / 0.3)', background: 'rgb(var(--color-brand-600) / 0.04)' }}
        >
          <h4 className="text-sm font-medium text-brand-800 flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4" />
            New logins - pending approval ({pendingLogins.length})
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Signed in but not on the workspace yet. Approve to grant access. Added as Viewer by default; change the role anytime below.
          </p>
          <div className="space-y-2">
            {pendingLogins.map((p) => (
              <PendingLoginRow
                key={p.id}
                profile={p}
                approving={approvingId === p.id}
                onApprove={(role) => handleApprove(p.id, role)}
              />
            ))}
          </div>
        </div>
      )}

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
                <div key={invite.id} className="flex items-center justify-between bg-surface-card rounded-lg px-3 py-2.5 border border-amber-200/60">
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
                      className="p-1.5 text-slate-400 hover:text-accent-crimson hover:bg-accent-crimson/[0.031] rounded-lg transition-colors"
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

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
        <table className="w-full">
          <thead className="bg-brand-600/[0.071]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Member</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Joined</th>
              {(isAdmin || isOwner) && (
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
                  className={`${isCurrentUser ? 'bg-brand-50/50' : 'hover:bg-brand-600/[0.094]'} transition-colors`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={member.profile.avatar_url} name={member.profile.full_name} size="lg" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {member.profile.full_name || 'Unnamed'}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-brand-600 font-normal">(you)</span>
                          )}
                          {member.profile.is_owner && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full align-middle">
                              <Crown className="w-2.5 h-2.5" /> Owner
                            </span>
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
                  {(isAdmin || isOwner) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isOwner && !isCurrentUser && (
                          <button
                            onClick={() => handleToggleOwner(member.user_id, !member.profile.is_owner)}
                            disabled={togglingOwnerId === member.user_id || (member.profile.is_owner && ownerCount <= 1)}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${member.profile.is_owner ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`}
                            title={member.profile.is_owner ? (ownerCount <= 1 ? 'Cannot remove the last owner' : 'Remove owner') : 'Make owner'}
                          >
                            {togglingOwnerId === member.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                          </button>
                        )}
                        {isAdmin && !isCurrentUser && (
                          <button
                            onClick={() => setRemovingId(member.user_id)}
                            className="p-1.5 text-slate-400 hover:text-accent-crimson hover:bg-accent-crimson/[0.031] rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && currentWorkspace && (
        <AddMemberModal
          workspaceId={currentWorkspace.id}
          existingMemberIds={members.map(m => m.user_id)}
          onClose={() => setShowAddMemberModal(false)}
          onAdded={fetchMembers}
        />
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/[0.376]" onClick={() => setRemovingId(null)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-crimson/[0.071] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-accent-crimson" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Remove Team Member?</h3>
            </div>
            <p className="text-slate-600 mb-6">
              This person will lose access to this workspace. They can be re-invited later.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRemovingId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-600/[0.063] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => removingId && handleRemoveMember(removingId)}
                className="px-4 py-2 text-sm font-medium text-white bg-accent-crimson hover:bg-[#a02525] rounded-lg transition-colors"
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
          <div className="absolute z-50 mt-1 bg-surface-card rounded-xl shadow-lg min-w-[140px]" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)', background: 'linear-gradient(135deg, rgb(var(--color-brand-600) / 0.094) 0%, transparent 50%), #ffffff' }}>
            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, config]) => (
              <button
                key={role}
                onClick={() => {
                  setIsOpen(false);
                  if (role !== currentRole) onChange(role);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-brand-600/[0.094] flex items-center gap-2 ${
                  role === currentRole ? 'bg-brand-50' : ''
                }`}
              >
                <config.icon className="w-3.5 h-3.5 text-slate-500" />
                <span className={role === currentRole ? 'text-brand-900 font-medium' : 'text-slate-700'}>
                  {config.label}
                </span>
                {role === currentRole && <Check className="w-4 h-4 ml-auto text-brand-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PendingLoginRow({
  profile,
  approving,
  onApprove,
}: {
  profile: Profile;
  approving: boolean;
  onApprove: (role: Role) => void;
}) {
  const [role, setRole] = useState<Role>('viewer');
  return (
    <div
      className="flex items-center justify-between bg-surface-card rounded-lg px-3 py-2.5"
      style={{ border: '1px solid rgb(var(--color-brand-900) / 0.12)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{profile.full_name || 'Unnamed'}</p>
          <p className="text-xs text-slate-500 truncate">{profile.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <div className="w-32">
          <StyledSelect
            value={role}
            onChange={(v) => setRole(v as Role)}
            options={[
              { value: 'viewer', label: 'Viewer' },
              { value: 'editor', label: 'Editor' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        </div>
        <button
          onClick={() => onApprove(role)}
          disabled={approving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve
        </button>
      </div>
    </div>
  );
}

function AddMemberModal({
  workspaceId,
  existingMemberIds,
  onClose,
  onAdded,
}: {
  workspaceId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('editor');

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (!error && data) {
        // Filter out users who are already members
        const filtered = data.filter(
          (p) => !existingMemberIds.includes(p.id) && p.id !== user?.id
        );
        setAvailableUsers(filtered);
      }
      setLoading(false);
    }
    fetchUsers();
  }, [existingMemberIds, user?.id]);

  const filteredUsers = availableUsers.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  });

  const handleAdd = async (profile: Profile) => {
    setAddingId(profile.id);

    const { error } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: workspaceId, user_id: profile.id, role: selectedRole });

    if (error) {
      toast.error('Failed to add member: ' + error.message);
    } else {
      toast.success(`${profile.full_name || profile.email} added as ${selectedRole}`);
      // Remove from list
      setAvailableUsers((prev) => prev.filter((p) => p.id !== profile.id));
      onAdded();
    }
    setAddingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/[0.376]" onClick={onClose}>
      <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Add Existing User</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Add users who have already signed up to your workspace.
        </p>

        {/* Role selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Add as role</label>
          <StyledSelect
            value={selectedRole}
            onChange={(v) => setSelectedRole(v as Role)}
            options={[
              { value: 'editor', label: 'Editor — can create, edit, and manage content' },
              { value: 'admin', label: 'Admin — full access including settings' },
              { value: 'viewer', label: 'Viewer — read-only access, can comment' },
            ]}
          />
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm text-slate-700 bg-surface-card border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Search by name or email..."
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {availableUsers.length === 0
                ? 'No users available to add'
                : 'No users match your search'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-brand-600/[0.094] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {profile.full_name || 'Unnamed'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(profile)}
                    disabled={addingId === profile.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ml-3"
                  >
                    {addingId === profile.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/[0.376]" onClick={onClose}>
      <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Invite Team Member</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm text-slate-700 bg-surface-card border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="colleague@company.com"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <StyledSelect
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={[
                { value: 'editor', label: 'Editor — can create, edit, and manage content' },
                { value: 'admin', label: 'Admin — full access including settings' },
                { value: 'viewer', label: 'Viewer — read-only access, can comment' },
              ]}
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'error'
                  ? 'bg-accent-crimson/[0.031] text-accent-crimson border border-accent-crimson/[0.188]'
                  : message.type === 'info'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-accent-mint/[0.094] text-accent-teal border border-accent-mint/[0.251]'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-600/[0.063] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={sending || !email.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
