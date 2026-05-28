import { useState, useEffect } from 'react';
import { X, Mic, Search, Loader2, Plus, Link, ChevronRight, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useGranolaSync, GranolaNoteSummary } from '../../hooks/useGranolaSync';
import { format } from 'date-fns';
import { GRANOLA_TEXT as GRANOLA_GREEN } from '../../lib/ordinal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the picker is in "link" mode for this specific content item */
  contentItemId?: string;
  /** Called when user picks "Create from this note" */
  onCreateFromNote?: (note: GranolaNoteSummary) => void;
  /** Called when a note is linked to the content item */
  onLinked?: () => void;
}

export function GranolaNotePickerModal({
  isOpen,
  onClose,
  contentItemId,
  onCreateFromNote,
  onLinked,
}: Props) {
  const { currentWorkspace } = useWorkspace();
  const { fetchNotes, linkNote, loading, error } = useGranolaSync(
    currentWorkspace?.id || null
  );

  const [notes, setNotes] = useState<GranolaNoteSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(false);

  // Load notes when modal opens
  useEffect(() => {
    if (isOpen && !initialLoad) {
      loadNotes();
    }
    if (!isOpen) {
      setInitialLoad(false);
      setNotes([]);
      setCursor(null);
      setSearch('');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadNotes(nextCursor?: string) {
    const result = await fetchNotes({
      cursor: nextCursor || undefined,
      page_size: 20,
    });
    if (result) {
      if (nextCursor) {
        setNotes((prev) => [...prev, ...result.notes]);
      } else {
        setNotes(result.notes);
      }
      setHasMore(result.hasMore);
      setCursor(result.cursor);
      setInitialLoad(true);
    }
  }

  async function handleLink(note: GranolaNoteSummary) {
    if (!contentItemId) return;
    setLinking(note.id);
    const result = await linkNote(note.id, contentItemId);
    setLinking(null);
    if (result) {
      onLinked?.();
      onClose();
    }
  }

  // Client-side search filtering
  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title?.toLowerCase().includes(search.toLowerCase()) ||
          n.owner.email.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#00233960] flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" style={{ border: '1px solid #00233930' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${GRANOLA_GREEN}15` }}
            >
              <Mic className="w-4 h-4" style={{ color: GRANOLA_GREEN }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {contentItemId ? 'Link Meeting Note' : 'Meeting Notes'}
              </h2>
              <p className="text-xs text-slate-500">
                {contentItemId
                  ? 'Choose a note to link to this item'
                  : 'Browse your Granola meeting notes'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#005D9710] transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 px-5 py-3 bg-[#BA2C2C08] text-accent-crimson text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && notes.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading your Granola notes...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {search ? 'No notes match your search' : 'No notes found in your Granola account'}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[#005D9708] transition-colors group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${GRANOLA_GREEN}10` }}
                  >
                    <Mic className="w-3.5 h-3.5" style={{ color: GRANOLA_GREEN }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {note.title || 'Untitled Meeting'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(note.created_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {contentItemId ? (
                      <button
                        onClick={() => handleLink(note)}
                        disabled={linking === note.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors"
                        style={{
                          color: GRANOLA_GREEN,
                          backgroundColor: `${GRANOLA_GREEN}10`,
                        }}
                      >
                        {linking === note.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Link className="w-3 h-3" />
                        )}
                        Link
                      </button>
                    ) : (
                      <button
                        onClick={() => onCreateFromNote?.(note)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors"
                        style={{
                          color: GRANOLA_GREEN,
                          backgroundColor: `${GRANOLA_GREEN}10`,
                        }}
                      >
                        <Plus className="w-3 h-3" />
                        Create Item
                      </button>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && !search && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button
                onClick={() => loadNotes(cursor || undefined)}
                disabled={loading}
                className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Load more notes'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
