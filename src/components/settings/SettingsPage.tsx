import React, { useState } from 'react';
import {
  Building2, Layers, Columns, ChevronRight, ChevronUp, ChevronDown,
  Loader2, Plus, Trash2, GripVertical, Check, X, Pencil, Inbox, ArrowLeft, Users, Plug
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ContentType, BoardColumn } from '../../lib/database.types';
import { ContentTypeEditor } from './ContentTypeEditor';
import { IntakeFormsList } from './IntakeFormBuilder';
import { TeamSettings } from './TeamSettings';
import { IntegrationsPage } from './IntegrationsPage';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type Section = 'workspace' | 'content-types' | 'board-columns' | 'intake-forms' | 'team' | 'integrations';

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6', '#6366F1',
  '#6B7280', '#84CC16', '#A855F7', '#0EA5E9', '#F43F5E',
];

export function SettingsPage({ addToast }: Props) {
  const { workspace, contentTypes, boardColumns, refreshWorkspaceData, userRole } = useApp();
  const [section, setSection] = useState<Section>('workspace');
  const [editingContentType, setEditingContentType] = useState<ContentType | null>(null);
  const [saving, setSaving] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(workspace?.name ?? '');

  // Content type editing
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeValues, setEditTypeValues] = useState<Partial<ContentType>>({});
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#3B82F6');

  // Board column editing
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColValues, setEditColValues] = useState<Partial<BoardColumn>>({});
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColColor, setNewColColor] = useState('#6B7280');

  const isAdmin = userRole === 'admin';

  async function saveWorkspaceName() {
    if (!workspace) return;
    setSaving(true);
    const { error } = await supabase.from('workspaces').update({ name: workspaceName }).eq('id', workspace.id);
    setSaving(false);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    addToast('Workspace name updated');
  }

  async function saveContentType() {
    if (!editingTypeId || !editTypeValues.name?.trim()) return;
    const { error } = await supabase
      .from('content_types')
      .update({ name: editTypeValues.name, color: editTypeValues.color })
      .eq('id', editingTypeId);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    setEditingTypeId(null);
    addToast('Content type updated');
  }

  async function addContentType() {
    if (!newTypeName.trim() || !workspace) return;
    const { error } = await supabase.from('content_types').insert({
      workspace_id: workspace.id,
      name: newTypeName.trim(),
      color: newTypeColor,
    });
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    setNewTypeName('');
    setAddingType(false);
    addToast('Content type added');
  }

  async function deleteContentType(id: string) {
    if (!confirm('Delete this content type?')) return;
    const { error } = await supabase.from('content_types').delete().eq('id', id);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    addToast('Content type deleted');
  }

  async function saveBoardColumn() {
    if (!editingColId || !editColValues.name?.trim()) return;
    const { error } = await supabase
      .from('board_columns')
      .update({ name: editColValues.name, color: editColValues.color })
      .eq('id', editingColId);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    setEditingColId(null);
    addToast('Board column updated');
  }

  async function addBoardColumn() {
    if (!newColName.trim() || !workspace) return;
    const maxPos = Math.max(...boardColumns.map(c => c.position), -1);
    const { error } = await supabase.from('board_columns').insert({
      workspace_id: workspace.id,
      name: newColName.trim(),
      color: newColColor,
      position: maxPos + 1,
    });
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    setNewColName('');
    setAddingCol(false);
    addToast('Board column added');
  }

  async function deleteBoardColumn(id: string) {
    if (!confirm('Delete this column? Content items assigned to it will lose their status.')) return;
    const { error } = await supabase.from('board_columns').delete().eq('id', id);
    if (error) { addToast(error.message, 'error'); return; }
    await refreshWorkspaceData();
    addToast('Board column deleted');
  }

  async function moveColumn(col: BoardColumn, dir: 'up' | 'down') {
    const sorted = [...boardColumns].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(c => c.id === col.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    await Promise.all([
      supabase.from('board_columns').update({ position: swap.position }).eq('id', col.id),
      supabase.from('board_columns').update({ position: col.position }).eq('id', swap.id),
    ]);
    await refreshWorkspaceData();
  }

  // Content type drill-down view
  if (editingContentType) {
    return (
      <div className="flex h-full bg-gray-50">
        <nav className="w-56 bg-white border-r border-gray-200 p-4 shrink-0">
          <button
            onClick={() => setEditingContentType(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Settings
          </button>
          <div className="px-3 py-2 bg-mint rounded-lg">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: editingContentType.color }} />
              <span className="text-sm font-medium text-brand-800 truncate">{editingContentType.name}</span>
            </div>
          </div>
        </nav>
        <div className="flex-1 overflow-y-auto">
          <ContentTypeEditor
            contentType={editingContentType}
            addToast={addToast}
            onBack={() => setEditingContentType(null)}
          />
        </div>
      </div>
    );
  }

  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'workspace', label: 'Workspace', icon: Building2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'content-types', label: 'Content Types', icon: Layers },
    { id: 'board-columns', label: 'Board Columns', icon: Columns },
    { id: 'intake-forms', label: 'Intake Forms', icon: Inbox },
  ];

  return (
    <div className="flex h-full bg-gray-50">
      {/* Settings sidebar */}
      <nav className="w-56 bg-white border-r border-gray-200 p-4 shrink-0">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-2">Settings</h2>
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg mb-0.5 transition-colors
                ${section === item.id
                  ? 'bg-mint text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                {item.label}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {section === 'workspace' && (
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Workspace</h2>
            <p className="text-sm text-gray-500 mb-6">Manage your workspace settings.</p>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace name</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  {isAdmin && (
                    <button
                      onClick={saveWorkspaceName}
                      disabled={saving || !workspaceName.trim()}
                      className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace slug</label>
                <input
                  type="text"
                  value={workspace?.slug ?? ''}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">Slugs cannot be changed.</p>
              </div>
            </div>
          </div>
        )}

        {section === 'content-types' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-gray-900">Content Types</h2>
              {isAdmin && (
                <button
                  onClick={() => setAddingType(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500"
                >
                  <Plus className="w-4 h-4" /> Add type
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-6">Define the kinds of content your team creates. Click a type to configure its fields and workflow.</p>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {addingType && (
                <div className="p-4 bg-mint rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewTypeColor(c)}
                          className={`w-5 h-5 rounded-full transition-transform ${newTypeColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: newTypeColor }} />
                    <input
                      autoFocus
                      type="text"
                      value={newTypeName}
                      onChange={e => setNewTypeName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addContentType()}
                      placeholder="Type name"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <button onClick={addContentType} disabled={!newTypeName.trim()} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50">
                      Add
                    </button>
                    <button onClick={() => setAddingType(false)} className="p-1.5 text-gray-500 hover:text-gray-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {contentTypes.map(ct => (
                <div key={ct.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors">
                  {editingTypeId === ct.id ? (
                    <>
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_PRESETS.slice(0, 8).map(c => (
                          <button
                            key={c}
                            onClick={() => setEditTypeValues({ ...editTypeValues, color: c })}
                            className={`w-4 h-4 rounded-full ${(editTypeValues.color ?? ct.color) === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <input
                        autoFocus
                        value={editTypeValues.name ?? ct.name}
                        onChange={e => setEditTypeValues({ ...editTypeValues, name: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                        onKeyDown={e => e.key === 'Enter' && saveContentType()}
                      />
                      <button onClick={saveContentType} className="text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingTypeId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />
                      <button
                        className="flex-1 text-left text-sm text-gray-800 hover:text-brand-600 transition-colors"
                        onClick={() => setEditingContentType(ct)}
                      >
                        {ct.name}
                      </button>
                      <button
                        onClick={() => setEditingContentType(ct)}
                        className="text-xs text-gray-400 hover:text-brand-600 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                      >
                        Configure <ChevronRight className="w-3 h-3" />
                      </button>
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => { setEditingTypeId(ct.id); setEditTypeValues({ name: ct.name, color: ct.color }); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteContentType(ct.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {contentTypes.length === 0 && !addingType && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No content types yet. Add one above.</div>
              )}
            </div>
          </div>
        )}

        {section === 'board-columns' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-gray-900">Board Columns</h2>
              {isAdmin && (
                <button
                  onClick={() => setAddingCol(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500"
                >
                  <Plus className="w-4 h-4" /> Add column
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-6">Configure your content workflow stages.</p>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {addingCol && (
                <div className="p-4 bg-mint rounded-t-xl">
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewColColor(c)}
                        className={`w-5 h-5 rounded-full transition-transform ${newColColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: newColColor }} />
                    <input
                      autoFocus
                      type="text"
                      value={newColName}
                      onChange={e => setNewColName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addBoardColumn()}
                      placeholder="Column name"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <button onClick={addBoardColumn} disabled={!newColName.trim()} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50">
                      Add
                    </button>
                    <button onClick={() => setAddingCol(false)} className="p-1.5 text-gray-500 hover:text-gray-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {[...boardColumns].sort((a, b) => a.position - b.position).map((col, idx) => (
                <div key={col.id} className="flex items-center gap-3 px-4 py-3 group">
                  {isAdmin && (
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveColumn(col, 'up')} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveColumn(col, idx + 1 === boardColumns.length ? 'up' : 'down')} disabled={idx === boardColumns.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />

                  {editingColId === col.id ? (
                    <>
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_PRESETS.slice(0, 8).map(c => (
                          <button
                            key={c}
                            onClick={() => setEditColValues({ ...editColValues, color: c })}
                            className={`w-4 h-4 rounded-full ${(editColValues.color ?? col.color) === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <input
                        autoFocus
                        value={editColValues.name ?? col.name}
                        onChange={e => setEditColValues({ ...editColValues, name: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                        onKeyDown={e => e.key === 'Enter' && saveBoardColumn()}
                      />
                      <button onClick={saveBoardColumn} className="text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingColId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span className="flex-1 text-sm text-gray-800">{col.name}</span>
                      <span className="text-xs text-gray-400">Position {col.position}</span>
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => { setEditingColId(col.id); setEditColValues({ name: col.name, color: col.color }); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteBoardColumn(col.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'team' && (
          <TeamSettings addToast={addToast} />
        )}

        {section === 'integrations' && (
          <IntegrationsPage addToast={addToast} />
        )}

        {section === 'intake-forms' && (
          <IntakeFormsList addToast={addToast} />
        )}
      </div>
    </div>
  );
}
