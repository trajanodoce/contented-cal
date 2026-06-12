import { useState } from 'react';
import { Link2, X } from 'lucide-react';
import type { ContentItem, BoardColumn, Profile } from '../../lib/database.types';
import { TaskCategoryIcon } from './TaskCategoryIcon';
import { AvatarStack } from '../ui/Avatar';
import { formatDate } from '../../lib/utils';
import { TaskPickerModal } from './TaskPickerModal';

const BERRY = '#B8447A';
const BERRY_BORDER = '#B8447A40';
const BERRY_GLOW = '#B8447A08';
const BERRY_TINT = '#B8447A15';

interface Props {
  itemId: string;
  linkedTasks: ContentItem[];
  loading: boolean;
  /** All workspace tasks — passed in so the picker can filter without re-querying */
  workspaceTasks: ContentItem[];
  members: Profile[];
  boardColumns: BoardColumn[];
  onLinkTo: (otherTaskId: string) => Promise<{ ok: boolean; error?: string }>;
  onUnlinkFrom: (otherTaskId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Open another task in the slide-over (replaces current). Cmd-click should be handled by caller for new-tab. */
  onSelectTask?: (taskId: string) => void;
}

/**
 * Linked Tasks section — position 4 in the Details tab.
 *
 * Berry-tinted card with faint outer glow giving it a distinct visual zone
 * from Subtasks (white card above) and Assets (white card below). Lists
 * peer tasks linked to this one, each row showing category icon · title ·
 * status pill · assignee · due · unlink. "+ Link a task" opens the picker.
 *
 * Empty state still renders the section (with just the header + add button)
 * so the affordance is discoverable when there's nothing linked yet.
 */
export function LinkedTasksSection({
  itemId,
  linkedTasks,
  loading,
  workspaceTasks,
  members,
  boardColumns,
  onLinkTo,
  onUnlinkFrom,
  onSelectTask,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Tasks the picker should NOT offer: this task + already-linked tasks
  const excludedIds = new Set<string>([itemId, ...linkedTasks.map((t) => t.id)]);

  return (
    <>
      <div
        className="rounded-xl bg-white px-[18px] py-3"
        style={{
          border: `1px solid ${BERRY_BORDER}`,
          boxShadow: `0 0 0 3px ${BERRY_GLOW}`,
        }}
      >
        {/* Header */}
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2.5 flex items-center gap-1.5"
          style={{ color: BERRY }}
        >
          <Link2 className="w-3 h-3" />
          <span>Linked Tasks</span>
          {linkedTasks.length > 0 && <span className="font-bold">({linkedTasks.length})</span>}
          {/* "NEW" tag for the first few weeks — Taylor can remove after team adoption. */}
          <span
            className="ml-auto text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ color: BERRY, background: BERRY_TINT }}
          >
            NEW
          </span>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-1.5">
          {loading && linkedTasks.length === 0 && (
            <div className="text-xs text-slate-400 italic py-1">Loading…</div>
          )}

          {linkedTasks.map((task) => (
            <LinkedTaskRow
              key={task.id}
              task={task}
              members={members}
              boardColumns={boardColumns}
              onClick={() => onSelectTask?.(task.id)}
              onUnlink={() => onUnlinkFrom(task.id)}
            />
          ))}

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-xs font-medium text-left px-2 py-1.5 self-start hover:underline"
            style={{ color: BERRY }}
          >
            + Link a task
          </button>
        </div>
      </div>

      {pickerOpen && (
        <TaskPickerModal
          tasks={workspaceTasks}
          excludedIds={excludedIds}
          boardColumns={boardColumns}
          // Default to "All". Earlier version defaulted to the opposite
          // category (assumption: most links are content↔design), but that
          // makes the picker look empty in workspaces with few/no tasks of
          // the opposite category. User can still narrow with the chips.
          defaultCategoryFilter="all"
          onClose={() => setPickerOpen(false)}
          onPick={async (pickedId) => {
            const result = await onLinkTo(pickedId);
            if (result.ok) setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Linked task row                                                        */
/* ─────────────────────────────────────────────────────────────────────── */

interface LinkedTaskRowProps {
  task: ContentItem;
  members: Profile[];
  boardColumns: BoardColumn[];
  onClick: () => void;
  onUnlink: () => Promise<{ ok: boolean; error?: string }>;
}

function LinkedTaskRow({ task, members, boardColumns, onClick, onUnlink }: LinkedTaskRowProps) {
  const [unlinking, setUnlinking] = useState(false);
  const statusCol = boardColumns.find((c) => c.id === task.status);
  const taskMembers = members.filter((m) => task.assignee_ids?.includes(m.id));

  const handleUnlink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unlinking) return;
    setUnlinking(true);
    await onUnlink();
    // No setUnlinking(false) — the row unmounts when the parent state updates.
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-100"
      style={{
        background: '#F7F9FC',
        border: '1px solid #00233918',
      }}
    >
      <TaskCategoryIcon category={task.category} size={14} />

      <span
        className="text-[13px] font-medium text-slate-900 flex-1 truncate"
        title={task.title}
      >
        {task.title}
      </span>

      {statusCol && (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            color: statusCol.color ?? '#64748b',
            background: statusCol.color ? `${statusCol.color}1F` : '#f1f5f9',
          }}
          title={statusCol.name}
        >
          {statusCol.name}
        </span>
      )}

      {taskMembers.length > 0 && (
        <div className="flex-shrink-0">
          {/* max=2 here (vs 3 on full Board/List cards) — slide-over rows are
              a denser context; intentional, not an inconsistency. */}
          <AvatarStack
            users={taskMembers.map((m) => ({ src: m.avatar_url, name: m.full_name }))}
            size="xs-inline"
            max={2}
          />
        </div>
      )}

      {task.due_date && (
        <span className="text-[11px] text-slate-400 flex-shrink-0" title={`Due ${formatDate(task.due_date)}`}>
          {formatDate(task.due_date)}
        </span>
      )}

      <button
        type="button"
        onClick={handleUnlink}
        disabled={unlinking}
        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 flex-shrink-0 disabled:opacity-40"
        title="Unlink"
        aria-label="Unlink this task"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
