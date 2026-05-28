import { useState, useEffect } from 'react';
import { Mic, ExternalLink, ChevronDown, ChevronUp, Clock, Users, Folder, Loader2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { GranolaNoteLink, Json } from '../../lib/database.types';
import { format } from 'date-fns';
import { parseLocalDate } from '../../lib/utils';

const GRANOLA_GREEN = '#345A11';

interface Props {
  contentItemId: string;
  /** Callback to open the note picker modal in "link" mode */
  onLinkNote?: () => void;
}

interface Attendee {
  name?: string;
  email?: string;
}

function parseAttendees(raw: Json | null): Attendee[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((a: unknown) => {
      if (typeof a === 'string') return { name: a };
      if (typeof a === 'object' && a !== null) return a as Attendee;
      return { name: String(a) };
    });
  }
  return [];
}

function formatMeetingTime(start: string | null, end: string | null): string {
  if (!start) return '';
  try {
    const startDate = new Date(start);
    const formattedDate = format(startDate, 'MMM d, yyyy');
    const startTime = format(startDate, 'h:mm a');
    if (end) {
      const endDate = new Date(end);
      const endTime = format(endDate, 'h:mm a');
      return `${formattedDate} · ${startTime} – ${endTime}`;
    }
    return `${formattedDate} · ${startTime}`;
  } catch {
    return start;
  }
}

export function GranolaNoteSection({ contentItemId, onLinkNote }: Props) {
  const [notes, setNotes] = useState<GranolaNoteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchNotes() {
      setLoading(true);
      const { data, error } = await supabase
        .from('granola_note_links')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('meeting_start', { ascending: false });

      if (!cancelled) {
        setNotes(data || []);
        // Auto-expand if only one note
        if (data && data.length === 1) {
          setExpandedNotes(new Set([data[0].id]));
        }
        setLoading(false);
      }
    }

    fetchNotes();
    return () => { cancelled = true; };
  }, [contentItemId]);

  const toggleExpanded = (noteId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading meeting notes...</span>
      </div>
    );
  }

  if (notes.length === 0) {
    return onLinkNote ? (
      <div>
        <button
          onClick={onLinkNote}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-slate-200 text-slate-500 hover:border-green-300 hover:text-green-700 transition-colors w-full justify-center"
        >
          <Mic className="w-3.5 h-3.5" />
          Link a Meeting Note
        </button>
      </div>
    ) : null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5" style={{ color: GRANOLA_GREEN }} />
          Meeting Notes
          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-normal">
            {notes.length}
          </span>
        </label>
        {onLinkNote && (
          <button
            onClick={onLinkNote}
            className="flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 transition-colors"
            style={{ color: GRANOLA_GREEN, backgroundColor: `${GRANOLA_GREEN}10` }}
          >
            <Plus className="w-3 h-3" />
            Link
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notes.map(note => {
          const isExpanded = expandedNotes.has(note.id);
          const attendees = parseAttendees(note.attendees);
          const meetingTime = formatMeetingTime(note.meeting_start, note.meeting_end);

          return (
            <div
              key={note.id}
              className="rounded-xl border overflow-hidden transition-all"
              style={{ borderColor: `${GRANOLA_GREEN}30` }}
            >
              {/* Header — always visible */}
              <button
                onClick={() => toggleExpanded(note.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-green-50/50 transition-colors"
                style={{ backgroundColor: `${GRANOLA_GREEN}06` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${GRANOLA_GREEN}15` }}
                >
                  <Mic className="w-4 h-4" style={{ color: GRANOLA_GREEN }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {note.note_title || 'Untitled Meeting'}
                  </p>
                  {meetingTime && (
                    <p className="text-xs text-slate-500 mt-0.5">{meetingTime}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {note.web_url && (
                    <a
                      href={note.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors"
                      style={{
                        color: GRANOLA_GREEN,
                        borderColor: `${GRANOLA_GREEN}40`,
                        backgroundColor: `${GRANOLA_GREEN}08`,
                      }}
                    >
                      Open in Granola
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: `${GRANOLA_GREEN}15` }}>
                  {/* Meeting details row */}
                  <div className="flex flex-wrap gap-3 pt-3">
                    {meetingTime && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{meetingTime}</span>
                      </div>
                    )}
                    {note.granola_folder && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Folder className="w-3.5 h-3.5" />
                        <span>{note.granola_folder}</span>
                      </div>
                    )}
                  </div>

                  {/* Attendees */}
                  {attendees.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-medium">Attendees</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {attendees.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700"
                          >
                            {a.name || a.email || 'Unknown'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {(note.summary_text || note.summary_markdown) && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">Summary</p>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg border border-slate-100 p-3 max-h-[300px] overflow-y-auto leading-relaxed">
                        {note.summary_text || note.summary_markdown}
                      </div>
                    </div>
                  )}

                  {/* Sync info */}
                  {note.synced_at && (
                    <p className="text-[10px] text-slate-400 pt-1">
                      Last synced {format(new Date(note.synced_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
