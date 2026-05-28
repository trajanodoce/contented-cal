import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import {
  FolderOpen,
  Plus,
  Link2,
  Upload,
  Trash2,
  ExternalLink,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  X,
  Loader2,
  Pencil,
  Check,
} from 'lucide-react';

interface LibraryItem {
  id: string;
  type: 'file' | 'link';
  title: string;
  url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  storage_path: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  workspaceId: string;
  readOnly?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="w-5 h-5 text-slate-400" />;
  if (mimeType.startsWith('image/')) return <FileImage className="w-5 h-5 text-purple-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel'))
    return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes('document') || mimeType.includes('word'))
    return <FileText className="w-5 h-5 text-brand-500" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

export function ContentLibrary({ projectId, workspaceId, readOnly }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_library')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load library:', error);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Close add menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    if (showAddMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  async function addLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    setSaving(true);

    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    const { error } = await supabase.from('project_library').insert({
      project_id: projectId,
      workspace_id: workspaceId,
      type: 'link',
      title: linkTitle.trim(),
      url,
      added_by: user?.id,
    });

    if (error) {
      toast.error('Failed to add link');
    } else {
      toast.success('Link added');
      setLinkTitle('');
      setLinkUrl('');
      setShowLinkForm(false);
      fetchItems();
    }
    setSaving(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const storagePath = `${workspaceId}/${projectId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(storagePath, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(storagePath);

      const { error: dbError } = await supabase.from('project_library').insert({
        project_id: projectId,
        workspace_id: workspaceId,
        type: 'file',
        title: file.name,
        url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        added_by: user?.id,
      });

      if (dbError) {
        toast.error(`Failed to save ${file.name}`);
      } else {
        uploaded++;
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded`);
      fetchItems();
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
  }

  async function deleteItem(item: LibraryItem) {
    // Delete from storage if it's a file
    if (item.type === 'file' && item.storage_path) {
      await supabase.storage.from('project-files').remove([item.storage_path]);
    }

    const { error } = await supabase
      .from('project_library')
      .delete()
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Removed');
      setItems(prev => prev.filter(i => i.id !== item.id));
    }
  }

  function startEditing(item: LibraryItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditUrl(item.url ?? '');
  }

  async function saveEdit(item: LibraryItem) {
    if (!editTitle.trim()) return;
    const updates: Record<string, string> = { title: editTitle.trim() };
    if (item.type === 'link' && editUrl.trim()) {
      let url = editUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      updates.url = url;
    }

    const { error } = await supabase
      .from('project_library')
      .update(updates)
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update');
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i));
      toast.success('Updated');
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle('');
    setEditUrl('');
  }

  const fileItems = items.filter(i => i.type === 'file');
  const linkItems = items.filter(i => i.type === 'link');

  return (
    <div className="bg-surface-card rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Content Library</h3>
          {items.length > 0 && (
            <span className="text-xs text-slate-400 bg-[#005D9712] px-1.5 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
            {showAddMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-surface-card rounded-xl shadow-lg py-1 z-50" style={{ border: '1px solid #00233930', background: 'linear-gradient(135deg, #005D9708 0%, transparent 40%), #F7F9FC' }}>
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-[#005D9708]"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  Upload file
                </button>
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setShowLinkForm(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-[#005D9708]"
                >
                  <Link2 className="w-4 h-4 text-slate-400" />
                  Add link
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Uploading indicator */}
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-brand-600 mb-3 px-1">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading...
        </div>
      )}

      {/* Add link form */}
      {showLinkForm && (
        <div className="mb-4 p-3 bg-surface-nested rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">Add external link</span>
            <button
              onClick={() => { setShowLinkForm(false); setLinkTitle(''); setLinkUrl(''); }}
              className="p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Title (e.g., Brand Guidelines)"
            value={linkTitle}
            onChange={e => setLinkTitle(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addLink(); }}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={addLink}
            disabled={saving || !linkTitle.trim() || !linkUrl.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add Link
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : items.length === 0 && !showLinkForm ? (
        <div className="text-center py-8">
          <FolderOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No files or links yet</p>
          {!readOnly && (
            <p className="text-xs text-slate-400 mt-1">
              Upload documents or add external links to organize project resources.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Files section */}
          {fileItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Documents ({fileItems.length})
              </p>
              <div className="space-y-1.5">
                {fileItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#005D9708] group transition-colors"
                  >
                    {getFileIcon(item.file_type)}
                    <div className="flex-1 min-w-0">
                      {editingId === item.id ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(item);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          onBlur={() => saveEdit(item)}
                          className="w-full text-sm font-medium text-slate-800 border-b border-brand-400 outline-none bg-transparent"
                        />
                      ) : (
                        <a
                          href={item.url ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-800 hover:text-brand-600 truncate block"
                        >
                          {item.title}
                        </a>
                      )}
                      {item.file_size != null && editingId !== item.id && (
                        <span className="text-xs text-slate-400">
                          {formatFileSize(item.file_size)}
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 transition-opacity ${editingId === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {editingId === item.id ? (
                        <button
                          onClick={() => saveEdit(item)}
                          className="p-1 text-green-500 hover:text-green-600 rounded"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          {!readOnly && (
                            <button
                              onClick={() => startEditing(item)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <a
                            href={item.url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-brand-500 rounded"
                            title="Open"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {!readOnly && (
                            <button
                              onClick={() => deleteItem(item)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links section */}
          {linkItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Links ({linkItems.length})
              </p>
              <div className="space-y-1.5">
                {linkItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#005D9708] group transition-colors"
                  >
                    <Link2 className="w-5 h-5 text-brand-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingId === item.id ? (
                        <div className="space-y-1.5">
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            placeholder="Title"
                            className="w-full text-sm font-medium text-slate-800 border-b border-brand-400 outline-none bg-transparent"
                          />
                          <input
                            value={editUrl}
                            onChange={e => setEditUrl(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(item);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            placeholder="https://..."
                            className="w-full text-xs text-slate-500 border-b border-slate-300 outline-none bg-transparent"
                          />
                        </div>
                      ) : (
                        <a
                          href={item.url ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-800 hover:text-brand-600 truncate block"
                        >
                          {item.title}
                        </a>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 shrink-0 transition-opacity ${editingId === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {editingId === item.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(item)}
                            className="p-1 text-green-500 hover:text-green-600 rounded"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {!readOnly && (
                            <button
                              onClick={() => startEditing(item)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <a
                            href={item.url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-brand-500 rounded"
                            title="Open"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {!readOnly && (
                            <button
                              onClick={() => deleteItem(item)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
