import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, CheckSquare, Calendar, AlertCircle, Loader2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentItem, Subtask } from '../../lib/database.types';
import { formatDate, isOverdue, getPriorityDot } from '../../lib/utils';

interface Props {
  onItemClick: (item: ContentItem) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface SubtaskWithParent extends Subtask {
  parent?: ContentItem;
}

export function MyWorkView({ onItemClick, addToast }: Props) {
  const { user, contentItems, boardColumns, contentTypes, refreshContentItems } = useApp();
  const [mySubtasks, setMySubtasks] = useState<SubtaskWithParent[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(true);
  const [tab, setTab] = useState<'items' | 'subtasks'>('items');

  const myItems = useMemo(() => {
    if (!user) return [];
    return contentItems
      .filter(i => i.assignee_ids?.includes(user.id))
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
  }, [contentItems, user]);

  const loadMySubtasks = useCallback(async () => {
    if (!user) return;
    setLoadingSubtasks(true);
    const { data } = await supabase
      .from('subtasks')
      .select('*')
      .eq('assignee_id', user.id)
      .eq('completed', false)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (data) {
      const enriched = data.map(st => ({
        ...st,
        parent: contentItems.find(i => i.id === st.content_item_id),
      }));
      setMySubtasks(enriched);
    }
    setLoadingSubtasks(false);
  }, [user, contentItems]);

  useEffect(() => { loadMySubtasks(); }, [loadMySubtasks]);

  async function completeSubtask(subtask: SubtaskWithParent) {
    const { error } = await supabase.from('subtasks').update({ completed: true }).eq('id', subtask.id);
    if (error) { addToast(error.message, 'error'); return; }
    setMySubtasks(prev => prev.filter(s => s.id !== subtask.id));
    addToast('Subtask completed');
  }

  const overdueItems = myItems.filter(i => isOverdue(i.due_date));
  const upcomingItems = myItems.filter(i => !isOverdue(i.due_date));

  const tabs = [
    { id: 'items' as const, label: 'Assigned items', count: myItems.length },
    { id: 'subtasks' as const, label: 'My subtasks', count: mySubtasks.length },
  ];

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-mint-200 flex items-center justify-center">
            <User className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">My Work</h2>
            <p className="text-sm text-gray-500">Items and tasks assigned to you</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors font-medium
                ${tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'items' && (
          <div className="space-y-5">
            {myItems.length === 0 ? (
              <EmptyState
                icon={User}
                title="No assigned items"
                body="Content items assigned to you will appear here."
              />
            ) : (
              <>
                {overdueItems.length > 0 && (
                  <Section
                    title="Overdue"
                    icon={<AlertCircle className="w-4 h-4 text-red-500" />}
                    accent="red"
                  >
                    {overdueItems.map(item => (
                      <ItemRow key={item.id} item={item} onClick={() => onItemClick(item)} />
                    ))}
                  </Section>
                )}
                {upcomingItems.length > 0 && (
                  <Section
                    title="Upcoming"
                    icon={<Calendar className="w-4 h-4 text-gray-400" />}
                  >
                    {upcomingItems.map(item => (
                      <ItemRow key={item.id} item={item} onClick={() => onItemClick(item)} />
                    ))}
                  </Section>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'subtasks' && (
          <div>
            {loadingSubtasks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : mySubtasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="No open subtasks"
                body="Subtasks assigned to you will appear here."
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {mySubtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <button
                        onClick={() => completeSubtask(subtask)}
                        className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 flex items-center justify-center shrink-0 hover:border-green-500 hover:bg-green-50 transition-colors"
                      >
                        <Check className="w-2.5 h-2.5 text-transparent hover:text-green-500" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{subtask.title}</p>
                        {subtask.parent && (
                          <button
                            onClick={() => subtask.parent && onItemClick(subtask.parent)}
                            className="text-xs text-brand-500 hover:text-brand-700 mt-0.5 truncate block max-w-full text-left"
                          >
                            {subtask.parent.title}
                          </button>
                        )}
                      </div>
                      {subtask.due_date && (
                        <span className={`text-xs shrink-0 ${isOverdue(subtask.due_date) ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {formatDate(subtask.due_date)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, accent, children }: {
  title: string;
  icon: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 ${accent === 'red' ? 'text-red-600' : 'text-gray-600'}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-50">{children}</div>
      </div>
    </div>
  );
}

function ItemRow({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  const { contentTypes, boardColumns } = useApp();
  const ct = contentTypes.find(c => c.id === item.content_type_id);
  const col = boardColumns.find(c => c.id === item.status);
  const overdue = isOverdue(item.due_date);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
    >
      {ct ? (
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />
      ) : (
        <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-300" />
      )}
      <span className="flex-1 text-sm font-medium text-gray-800 truncate group-hover:text-brand-600 transition-colors">{item.title}</span>
      <span className={`text-xs shrink-0 ${getPriorityDot(item.priority)}`}>{item.priority}</span>
      {col && (
        <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium" style={{ backgroundColor: `${col.color}20`, color: col.color }}>
          {col.name}
        </span>
      )}
      {item.due_date && (
        <span className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {formatDate(item.due_date)}
        </span>
      )}
    </button>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-3 shadow-sm">
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 max-w-xs">{body}</p>
    </div>
  );
}
