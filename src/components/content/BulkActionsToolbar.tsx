import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { X, Trash2, UserPlus, ChevronDown, User, AlertTriangle } from 'lucide-react';
import type { Profile, BoardColumn } from '../../lib/database.types';

interface BulkActionsToolbarProps {
  selectedCount: number;
  selectedIds: string[];
  members: Profile[];
  boardColumns: BoardColumn[];
  onClear: () => void;
  onUpdate: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  selectedIds,
  members,
  boardColumns,
  onClear,
  onUpdate,
}: BulkActionsToolbarProps) {
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const assignRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleBulkAssign(memberId: string) {
    setShowAssignDropdown(false);
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const member = members.find((m) => m.id === memberId);

      const updates = selectedIds.map(async (id) => {
        const { data: item } = await supabase
          .from('content_items')
          .select('assignee_ids')
          .eq('id', id)
          .single();

        const currentIds = item?.assignee_ids || [];
        const newIds = currentIds.includes(memberId) ? currentIds : [...currentIds, memberId];

        await supabase.from('content_items').update({ assignee_ids: newIds }).eq('id', id);

        await supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user?.id || null,
          action: `assigned to ${member?.full_name || member?.email || 'member'}`,
          metadata: { assigneeId: memberId, assigneeIds: newIds },
        });
      });

      await Promise.all(updates);

      toast.success(`Assigned ${selectedCount} item(s) to ${member?.full_name || member?.email}`);
      onUpdate();
      onClear();
    } catch (err) {
      toast.error('Failed to bulk assign: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBulkStatusChange(statusId: string) {
    setShowStatusDropdown(false);
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const status = boardColumns.find((bc) => bc.id === statusId);

      // Sync completed boolean when bulk-moving to/from done columns
      const statusName = status?.name?.toLowerCase();
      const isDone = statusName === 'published' || statusName === 'completed';
      const payload: Record<string, unknown> = { status: statusId };
      if (isDone) {
        payload.completed = true;
        payload.completed_at = new Date().toISOString();
      }

      const updates = selectedIds.map(async (id) => {
        await supabase.from('content_items').update(payload).eq('id', id);

        await supabase.from('activity_log').insert({
          content_item_id: id,
          user_id: user?.id || null,
          action: `changed status to ${status?.name || 'None'}`,
          metadata: { newStatus: statusId },
        });
      });

      await Promise.all(updates);

      toast.success(`Updated status for ${selectedCount} item(s) to ${status?.name}`);
      onUpdate();
      onClear();
    } catch (err) {
      toast.error('Failed to bulk update status: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBulkDelete() {
    setIsProcessing(true);

    try {
      const { error } = await supabase.from('content_items').delete().in('id', selectedIds);

      if (error) throw error;

      toast.success(`Deleted ${selectedCount} item(s)`);
      onUpdate();
      onClear();
      setShowDeleteConfirm(false);
    } catch (err) {
      toast.error('Failed to delete: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      {/* Floating Bulk Actions Toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-surface-card shadow-xl rounded-xl px-4 py-3" style={{ border: '1px solid #00233930' }}>
        <span className="text-sm font-medium text-slate-700">
          {selectedCount} selected
        </span>

        <div className="h-6 w-px bg-slate-200" />

        {/* Assign to button */}
        <div ref={assignRef} className="relative">
          <button
            onClick={() => setShowAssignDropdown(!showAssignDropdown)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-[#005D9710] rounded-lg transition-colors disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            Assign to...
            <ChevronDown className="w-3 h-3" />
          </button>

          {showAssignDropdown && (
            <div className="absolute bottom-full mb-1 left-0 bg-surface-card rounded-xl shadow-xl min-w-[200px] max-h-[300px] overflow-y-auto" style={{ border: '1px solid #00233930', background: '#ffffff' }}>
              <div className="p-2">
                <p className="text-xs font-medium text-slate-500 uppercase px-2 py-1">Select member</p>
                {members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleBulkAssign(member.id)}
                    className="w-full px-2 py-2 text-left text-sm hover:bg-[#005D9708] flex items-center gap-2 rounded"
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.full_name ?? member.email ?? undefined}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-500" />
                      </div>
                    )}
                    <span className="text-slate-700">{member.full_name || member.email}</span>
                  </button>
                ))}
  </div>
            </div>
          )}
        </div>

        {/* Change status button */}
        <div ref={statusRef} className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-[#005D9710] rounded-lg transition-colors disabled:opacity-50"
          >
            Change status...
            <ChevronDown className="w-3 h-3" />
          </button>

          {showStatusDropdown && (
            <div className="absolute bottom-full mb-1 left-0 bg-surface-card rounded-xl shadow-xl min-w-[180px]" style={{ border: '1px solid #00233930', background: '#ffffff' }}>
              <div className="p-2">
                <p className="text-xs font-medium text-slate-500 uppercase px-2 py-1">Select status</p>
                {[...boardColumns]
                  .sort((a, b) => a.position - b.position)
                  .map((column) => (
                    <button
                      key={column.id}
                      onClick={() => handleBulkStatusChange(column.id)}
                      className="w-full px-2 py-2 text-left text-sm hover:bg-[#005D9708] flex items-center gap-2 rounded"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: column.color ?? undefined }}
                      />
                      <span className="text-slate-700">{column.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent-crimson hover:bg-[#BA2C2C08] rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>

        {/* Cancel button */}
        <button
          onClick={onClear}
          disabled={isProcessing}
          className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-[#005D9710] rounded-lg transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#00233960]" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#BA2C2C12] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-accent-crimson" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete {selectedCount} items?</h3>
            </div>
            <p className="text-slate-600 mb-6">
              This action cannot be undone. The selected content items will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#005D9710] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-accent-crimson hover:bg-[#a02525] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
