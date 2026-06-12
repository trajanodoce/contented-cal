import { useState, useEffect } from 'react';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { Comment, Profile } from '../../lib/database.types';
import { formatRelativeTime } from '../../lib/relativeTime';
import { renderBodyWithMentions, extractMentionIds } from '../../lib/mentionFormat';
import { MentionAutocomplete, type MentionableMember } from './MentionAutocomplete';

export interface CommentWithProfile extends Comment {
  profiles: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
  deletedByProfile?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

interface Props {
  comment: CommentWithProfile;
  /** Current viewer's user_id (from auth). */
  currentUserId: string | null;
  /** True if viewer is workspace admin (extends edit/delete rights to any comment). */
  isAdmin: boolean;
  /** Workspace members for @mention autocomplete in edit mode. */
  members: MentionableMember[];
  /** Persist body edit. Receives the new body + extracted mention uuids. */
  onEdit: (commentId: string, newBody: string, mentions: string[]) => Promise<boolean>;
  /** Soft-delete the comment. Returns success boolean. */
  onDelete: (commentId: string) => Promise<boolean>;
}

/**
 * Phase 6.2 — Comment row with edit/delete/tombstone affordances.
 *
 * Hover-revealed Edit + Delete actions appear in the top-right for the
 * comment's author or any workspace admin. Inline edit mode swaps the body
 * for a textarea with Cancel/Save. Soft-deleted comments render as a quiet
 * tombstone ("Comment deleted") to preserve thread context without keeping
 * stale content visible.
 */
export function CommentRow({ comment, currentUserId, isAdmin, members, onEdit, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // When entering edit mode, seed the editor with the current body.
  useEffect(() => {
    if (isEditing) {
      setEditedBody(comment.body);
    }
  }, [isEditing, comment.body]);

  const isDeleted = comment.deleted_at !== null;
  const isAuthor = currentUserId === comment.user_id;
  const canEdit = isAuthor && !isDeleted;
  const canDelete = (isAuthor || isAdmin) && !isDeleted;
  const wasEdited = !isDeleted
    && comment.updated_at
    && new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 2000;

  const authorName = comment.profiles?.full_name || comment.profiles?.email || 'Unknown';

  // --- Tombstone state ----------------------------------------------------
  if (isDeleted) {
    const deletedByName = comment.deletedByProfile?.full_name
      || comment.deletedByProfile?.email
      || (comment.deleted_by === comment.user_id ? authorName : 'an admin');
    return (
      <div className="flex gap-3 opacity-60">
        <div className="w-8 h-8 flex-shrink-0" />
        <div className="flex-1 text-xs italic text-slate-400 py-1">
          Comment deleted by {deletedByName}
        </div>
      </div>
    );
  }

  // --- Edit mode ----------------------------------------------------------
  if (isEditing) {
    const trimmed = editedBody.trim();
    const unchanged = trimmed === comment.body.trim();
    const handleSave = async () => {
      if (!trimmed || unchanged) {
        setIsEditing(false);
        return;
      }
      setSaving(true);
      const mentions = extractMentionIds(trimmed);
      const ok = await onEdit(comment.id, trimmed, mentions);
      setSaving(false);
      if (ok) setIsEditing(false);
    };
    return (
      <div className="flex gap-3">
        <Avatar src={comment.profiles?.avatar_url} name={authorName} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-medium text-slate-700">{authorName}</span>
            <span className="text-xs text-slate-400">Editing…</span>
          </div>
          <MentionAutocomplete
            value={editedBody}
            onChange={setEditedBody}
            members={members}
            rows={Math.min(8, Math.max(2, editedBody.split('\n').length + 1))}
            disabled={saving}
            autoFocus
            className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                // Only cancel edit mode if dropdown isn't capturing Esc itself.
                // The autocomplete preventDefault()s its own Esc handling, so
                // by the time we get here the dropdown is already closed/closing.
                if (!e.defaultPrevented) {
                  e.preventDefault();
                  setIsEditing(false);
                }
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving || !trimmed || unchanged}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-md hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-600 text-xs font-medium rounded-md hover:bg-slate-100 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <span className="text-[10px] text-slate-400 ml-1">⌘↵ to save · Esc to cancel</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Default view ------------------------------------------------------
  return (
    <>
      <div className="group flex gap-3">
        <Avatar src={comment.profiles?.avatar_url} name={authorName} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-slate-700">{authorName}</span>
            <span className="text-xs text-slate-400" title={new Date(comment.created_at).toLocaleString()}>
              {formatRelativeTime(comment.created_at)}
            </span>
            {wasEdited && (
              <span
                className="text-[10px] text-slate-400 italic"
                title={`Edited ${formatRelativeTime(comment.updated_at)}`}
              >
                (edited)
              </span>
            )}
            {/* Hover-revealed actions, pushed to the right */}
            {(canEdit || canDelete) && (
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Edit comment"
                    aria-label="Edit comment"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={deleting}
                    className="p-1 rounded text-slate-400 hover:text-accent-crimson hover:bg-accent-crimson/[0.051] transition-colors disabled:opacity-50"
                    title="Delete comment"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap break-words">
            {renderBodyWithMentions(comment.body, (m) => (
              <span
                key={`${m.uuid}-${m.start}`}
                className="inline-flex items-baseline rounded-full px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'rgb(var(--color-brand-600) / 0.071)', color: 'rgb(var(--color-brand-600))' }}
                title={`Mentioned: ${m.name}`}
              >
                @{m.name}
              </span>
            ))}
          </p>
        </div>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          setDeleting(true);
          const ok = await onDelete(comment.id);
          setDeleting(false);
          setConfirmDeleteOpen(false);
          // No need to do anything else — realtime will refresh into tombstone.
          return ok;
        }}
        variant="destructive"
        title="Delete this comment?"
        description="This will mark the comment as deleted. The thread will keep the tombstone so context isn't lost, but the body won't be visible anymore."
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}
