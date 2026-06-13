import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { Workspace } from '../../lib/database.types';
import {
  Loader2,
  Plus,
  ArrowRightCircle,
  Archive as ArchiveIcon,
  RotateCcw,
  Building2,
} from 'lucide-react';

interface WorkspaceRow extends Workspace {
  member_count: number;
  project_count: number;
}

/**
 * Owner-only roster of every workspace in the app (owner-bypass RLS lets owners
 * read members/projects across all workspaces for the counts). Create / switch /
 * soft-archive. Gated to owners in SettingsPage.
 */
export function WorkspacesTab() {
  const { currentWorkspace, switchWorkspace, createWorkspace, refreshWorkspaces } = useWorkspace();
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [wsRes, memRes, projRes] = await Promise.all([
      supabase.from('workspaces').select('*').order('name'),
      supabase.from('workspace_members').select('workspace_id'),
      supabase.from('projects').select('workspace_id'),
    ]);
    const memCounts = new Map<string, number>();
    (memRes.data || []).forEach((m: { workspace_id: string }) =>
      memCounts.set(m.workspace_id, (memCounts.get(m.workspace_id) || 0) + 1),
    );
    const projCounts = new Map<string, number>();
    (projRes.data || []).forEach((p: { workspace_id: string }) =>
      projCounts.set(p.workspace_id, (projCounts.get(p.workspace_id) || 0) + 1),
    );
    const mapped = (wsRes.data || []).map((w) => ({
      ...w,
      member_count: memCounts.get(w.id) || 0,
      project_count: projCounts.get(w.id) || 0,
    }));
    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const activeCount = rows.filter((r) => !r.archived).length;

  const handleArchive = async (w: WorkspaceRow, archived: boolean) => {
    if (archived && w.id === currentWorkspace?.id) {
      toast.error('Switch to another workspace before archiving this one.');
      return;
    }
    if (archived && activeCount <= 1) {
      toast.error('Cannot archive the last active workspace.');
      return;
    }
    setBusyId(w.id);
    const { error } = await supabase.from('workspaces').update({ archived }).eq('id', w.id);
    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success(archived ? 'Workspace archived' : 'Workspace restored');
      fetchAll();
      refreshWorkspaces();
    }
    setBusyId(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const slug = newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const { error } = await createWorkspace(newName.trim(), slug);
    if (error) {
      toast.error('Failed to create: ' + error.message);
    } else {
      toast.success('Workspace created');
      setShowCreate(false);
      setNewName('');
      fetchAll();
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Workspaces</h3>
          <p className="text-sm text-slate-500 mt-1">
            Every workspace in the app. Create, switch, or archive — owners only.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create workspace
        </button>
      </div>

      {showCreate && (
        <div
          className="bg-surface-nested rounded-lg p-4 flex items-end gap-3"
          style={{ border: '1px solid rgb(var(--color-brand-900) / 0.12)' }}
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Workspace name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              placeholder="Acme Marketing"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-50 flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
          <button
            onClick={() => {
              setShowCreate(false);
              setNewName('');
            }}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-brand-600/[0.063] rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
        <table className="w-full">
          <thead className="bg-brand-600/[0.071]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Workspace</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Members</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Projects</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((w) => {
              const isCurrent = w.id === currentWorkspace?.id;
              return (
                <tr key={w.id} className={w.archived ? 'opacity-50' : 'hover:bg-brand-600/[0.05]'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {w.name}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">Current</span>
                          )}
                          {w.archived && (
                            <span className="ml-2 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Archived</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">contentedcal.com/{w.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{w.member_count}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{w.project_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!w.archived && !isCurrent && (
                        <button
                          onClick={() => switchWorkspace(w)}
                          title="Switch to this workspace"
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <ArrowRightCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleArchive(w, !w.archived)}
                        disabled={busyId === w.id || (!w.archived && (isCurrent || activeCount <= 1))}
                        title={
                          w.archived
                            ? 'Restore workspace'
                            : isCurrent
                              ? 'Switch away before archiving'
                              : activeCount <= 1
                                ? 'Cannot archive the last workspace'
                                : 'Archive workspace'
                        }
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                      >
                        {busyId === w.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : w.archived ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <ArchiveIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
