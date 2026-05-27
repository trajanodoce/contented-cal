import { useState, useEffect, useCallback, useRef } from 'react';
import { Link2, Plus, ExternalLink as ExternalLinkIcon, Loader2, X, Image, Upload, FileText, FileImage, FileVideo, FileArchive, File } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import type { ExternalLink, ExternalLinkPlatform } from '../../lib/database.types';

interface Props {
  contentItemId: string;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  readOnly?: boolean;
}

// Platform metadata for display
const PLATFORM_META: Record<ExternalLinkPlatform, { label: string; bgColor: string; textColor: string; icon: string }> = {
  ordinal:      { label: 'Ordinal',      bgColor: '#FFF7ED', textColor: '#C2410C', icon: '⬡' },
  figma:        { label: 'Figma',        bgColor: '#F5F3FF', textColor: '#7C3AED', icon: 'F' },
  canva:        { label: 'Canva',        bgColor: '#EFF6FF', textColor: '#2563EB', icon: 'C' },
  miro:         { label: 'Miro',         bgColor: '#FFFBEB', textColor: '#D97706', icon: 'M' },
  google_docs:  { label: 'Google Docs',  bgColor: '#F0FDF4', textColor: '#15803D', icon: 'G' },
  google_drive: { label: 'Google Drive', bgColor: '#F0FDF4', textColor: '#15803D', icon: 'G' },
  notion:       { label: 'Notion',       bgColor: '#F9FAFB', textColor: '#374151', icon: 'N' },
  linear:       { label: 'Linear',       bgColor: '#EFF6FF', textColor: '#1D4ED8', icon: 'L' },
  granola:      { label: 'Granola',      bgColor: '#345A11', textColor: '#FFFFFF', icon: '🎙️' },
  file:         { label: 'File',         bgColor: '#F0F9FF', textColor: '#0369A1', icon: '📎' },
  other:        { label: 'Link',         bgColor: '#F9FAFB', textColor: '#4B5563', icon: '↗' },
};

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  webp: FileImage,
  svg: FileImage,
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  zip: FileArchive,
  rar: FileArchive,
};

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return FILE_TYPE_ICONS[ext] ?? File;
}

function isImageFile(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PlatformBadge({ platform }: { platform: ExternalLinkPlatform }) {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.other;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: meta.bgColor, color: meta.textColor }}
    >
      <span className="font-bold leading-none">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function LinkCard({ link, onDelete, readOnly = false }: { link: ExternalLink; onDelete: () => void; readOnly?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const isFile = link.platform === 'file';
  const metadata = (link.metadata ?? {}) as Record<string, unknown>;
  const fileName = (metadata.file_name as string) ?? link.title ?? 'File';
  const fileSize = metadata.file_size as number | undefined;
  const isImage = isFile && isImageFile(fileName);
  const FileIcon = isFile ? getFileIcon(fileName) : Image;

  return (
    <div className="group bg-white border border-slate-300 rounded-xl overflow-hidden hover:shadow-md hover:border-slate-400 transition-all">
      {/* Thumbnail */}
      <div className="w-full h-28 bg-slate-50 flex items-center justify-center overflow-hidden relative">
        {isFile && isImage && !imgError ? (
          <img
            src={link.url}
            alt={fileName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : link.thumbnail_url && !imgError && !isFile ? (
          <img
            src={link.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : isFile ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <FileIcon className="w-8 h-8" />
            <span className="text-xs text-slate-400">{fileName.split('.').pop()?.toUpperCase()}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <Image className="w-8 h-8" />
            <span className="text-xs">No preview</span>
          </div>
        )}
        {!readOnly && (
          <button
            onClick={onDelete}
            className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <PlatformBadge platform={link.platform as ExternalLinkPlatform} />
        <p className="mt-1.5 text-sm font-medium text-slate-800 line-clamp-2 leading-snug">
          {isFile ? fileName : (link.title || 'Untitled')}
        </p>
        {isFile && fileSize ? (
          <p className="mt-0.5 text-xs text-slate-400">{formatFileSize(fileSize)}</p>
        ) : (metadata.description as string) ? (
          <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
            {metadata.description as string}
          </p>
        ) : null}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-500 transition-colors font-medium"
        >
          <ExternalLinkIcon className="w-3 h-3" />
          {isFile ? 'Download' : `Open in ${PLATFORM_META[link.platform as ExternalLinkPlatform]?.label ?? 'browser'}`}
        </a>
      </div>
    </div>
  );
}

export function ExternalLinksSection({ contentItemId, addToast, readOnly = false }: Props) {
  const { user } = useApp();
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const loadLinks = useCallback(async () => {
    const { data } = await supabase
      .from('external_links')
      .select('*')
      .eq('content_item_id', contentItemId)
      .order('created_at', { ascending: false });
    if (data) setLinks(data as ExternalLink[]);
    setLoading(false);
  }, [contentItemId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  async function handleAddLink() {
    if (!url.trim() || !user) return;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      addToast('Please enter a valid URL (include https://)', 'error');
      return;
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      addToast('Only HTTP/HTTPS URLs are supported', 'error');
      return;
    }

    setFetching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;

      let platform = 'other';
      let title = '';
      let thumbnail_url = '';
      let description = '';

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/fetch-link-metadata`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: url.trim() }),
        });
        if (res.ok) {
          const meta = await res.json();
          platform = meta.platform ?? 'other';
          title = meta.title ?? '';
          thumbnail_url = meta.thumbnail_url ?? '';
          description = meta.description ?? '';
        }
      } catch {
        // Metadata fetch failed — still allow saving the link
      }

      const { error } = await supabase.from('external_links').insert({
        content_item_id: contentItemId,
        platform: platform as ExternalLinkPlatform,
        url: url.trim(),
        title: title || parsedUrl.hostname,
        thumbnail_url,
        metadata: { description },
      });

      if (error) throw error;

      setUrl('');
      setAdding(false);
      await loadLinks();
      addToast('Link added');
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setFetching(false);
    }
  }

  // Shared upload logic for both file input and drag-and-drop
  async function uploadFiles(files: File[]) {
    if (files.length === 0 || !user) return;

    setUploading(true);
    try {
      for (const file of files) {
        const filePath = `${contentItemId}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('project-files')
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase.from('external_links').insert({
          content_item_id: contentItemId,
          platform: 'file' as ExternalLinkPlatform,
          url: urlData.publicUrl,
          title: file.name,
          thumbnail_url: null,
          metadata: {
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: filePath,
          },
        });

        if (insertError) throw insertError;
      }

      await loadLinks();
      addToast(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) uploadFiles(Array.from(files));
  }

  // Drag-and-drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (readOnly) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  }

  async function handleDelete(link: ExternalLink) {
    if (link.platform === 'file') {
      const metadata = (link.metadata ?? {}) as Record<string, unknown>;
      const storagePath = metadata.storage_path as string | undefined;
      if (storagePath) {
        await supabase.storage.from('project-files').remove([storagePath]);
      }
    }

    const { error } = await supabase.from('external_links').delete().eq('id', link.id);
    if (error) { addToast(error.message, 'error'); return; }
    setLinks(prev => prev.filter(l => l.id !== link.id));
    addToast(link.platform === 'file' ? 'File removed' : 'Link removed');
  }

  return (
    <div
      onDragEnter={!readOnly ? handleDragEnter : undefined}
      onDragLeave={!readOnly ? handleDragLeave : undefined}
      onDragOver={!readOnly ? handleDragOver : undefined}
      onDrop={!readOnly ? handleDrop : undefined}
      className="relative"
    >
      {/* Full-section drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/80 flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-sm font-semibold text-blue-600">Drop files to upload</p>
          <p className="text-xs text-blue-400 mt-0.5">Release to add to linked assets</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          Linked Assets {links.length > 0 && `(${links.length})`}
        </label>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-500 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add link
              </button>
            )}
          </div>
        )}
      </div>

      {adding && (
        <div className="mb-3 flex gap-2">
          <input
            autoFocus
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddLink();
              if (e.key === 'Escape') { setAdding(false); setUrl(''); }
            }}
            placeholder="https://www.figma.com/..."
            className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={handleAddLink}
            disabled={fetching || !url.trim()}
            className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {fetching ? 'Fetching...' : 'Add'}
          </button>
          <button
            onClick={() => { setAdding(false); setUrl(''); }}
            className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs border border-slate-200 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      ) : links.length === 0 && !readOnly ? (
        /* Empty state = clickable drop zone */
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
        >
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 text-blue-500 mb-2 animate-spin" />
              <p className="text-sm font-medium text-blue-600">Uploading...</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-colors">
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <p className="text-sm font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                Drop files here or click to upload
              </p>
              <p className="text-xs text-slate-400 mt-0.5">or paste a link using "Add link" above</p>
            </>
          )}
        </button>
      ) : links.length === 0 && readOnly ? (
        <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-slate-200 rounded-xl">
          <Link2 className="w-7 h-7 text-slate-300 mb-2" />
          <p className="text-xs text-slate-400">No linked assets yet</p>
        </div>
      ) : (
        /* Has links — show grid + drop zone at bottom */
        <>
          <div className="grid grid-cols-2 gap-3">
            {links.map(link => (
              <LinkCard key={link.id} link={link} readOnly={readOnly} onDelete={() => handleDelete(link)} />
            ))}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-xs font-medium text-blue-600">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">
                    Drop files or click to upload more
                  </span>
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Compact platform icons for use on cards
export function LinkPlatformIcons({ contentItemId }: { contentItemId: string }) {
  const [platforms, setPlatforms] = useState<ExternalLinkPlatform[]>([]);

  useEffect(() => {
    supabase
      .from('external_links')
      .select('platform')
      .eq('content_item_id', contentItemId)
      .then(({ data }) => {
        if (data) {
          const unique = Array.from(new Set(data.map(d => d.platform as ExternalLinkPlatform)));
          setPlatforms(unique);
        }
      });
  }, [contentItemId]);

  if (platforms.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5">
      {platforms.slice(0, 3).map(p => {
        const meta = PLATFORM_META[p] ?? PLATFORM_META.other;
        return (
          <span
            key={p}
            title={meta.label}
            className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center leading-none"
            style={{ backgroundColor: meta.bgColor, color: meta.textColor }}
          >
            {meta.icon}
          </span>
        );
      })}
      {platforms.length > 3 && (
        <span className="text-[9px] text-slate-400 font-medium">+{platforms.length - 3}</span>
      )}
    </div>
  );
}
