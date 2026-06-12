import { useState, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Save, Upload, X, ImageIcon } from 'lucide-react';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface GeneralTabProps {
  workspace: { id: string; name: string; slug: string; logo_url?: string | null } | null;
}

export function GeneralTab({ workspace }: GeneralTabProps) {
  const { refreshWorkspaces } = useWorkspace();
  const [name, setName] = useState(workspace?.name || '');
  const [slug, setSlug] = useState(workspace?.slug || '');
  const [logoUrl, setLogoUrl] = useState(workspace?.logo_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setSlug(workspace.slug);
      setLogoUrl(workspace.logo_url || '');
    }
  }, [workspace]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;

    e.target.value = '';

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, GIF, or WebP image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `logos/${workspace.id}.${ext}`;

      try {
        await supabase.storage.from('workspace-assets').remove([`logos/${workspace.id}.png`, `logos/${workspace.id}.jpg`, `logos/${workspace.id}.jpeg`, `logos/${workspace.id}.webp`]);
      } catch {
        // Non-critical — proceed with upload
      }

      const { error: uploadError } = await supabase.storage
        .from('workspace-assets')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        toast.error('Failed to upload logo: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('workspace-assets')
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ logo_url: publicUrl })
        .eq('id', workspace.id);

      if (updateError) {
        toast.error('Failed to save logo: ' + updateError.message);
      } else {
        setLogoUrl(publicUrl);
        toast.success('Logo updated!');
        await refreshWorkspaces();
      }
    } catch {
      toast.error('Logo upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!workspace) return;
    setIsUploading(true);
    try {
      try {
        await supabase.storage.from('workspace-assets').remove([`logos/${workspace.id}.png`, `logos/${workspace.id}.jpg`, `logos/${workspace.id}.jpeg`, `logos/${workspace.id}.webp`]);
      } catch {
        // Non-critical — proceed with DB update
      }

      const { error } = await supabase
        .from('workspaces')
        .update({ logo_url: null })
        .eq('id', workspace.id);

      if (error) {
        toast.error('Failed to remove logo: ' + error.message);
      } else {
        setLogoUrl('');
        toast.success('Logo removed');
        await refreshWorkspaces();
      }
    } catch {
      toast.error('Failed to remove logo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!workspace) return;
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 2) {
      toast.error('Slug must be lowercase letters, numbers, and hyphens only (min 2 characters)');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('workspaces')
      .update({ name: name.trim(), slug: slug.toLowerCase() })
      .eq('id', workspace.id);

    setIsSaving(false);

    if (error) {
      toast.error('Failed to update workspace: ' + error.message);
    } else {
      toast.success('Workspace updated successfully');
      await refreshWorkspaces();
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Workspace Logo</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-surface-nested overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-surface-card border border-slate-300 rounded-lg hover:bg-brand-600/[0.094] cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading...' : logoUrl ? 'Change logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
            {logoUrl && (
              <button
                onClick={handleRemoveLogo}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent-crimson hover:bg-accent-crimson/[0.031] rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Square image recommended. Max 2MB.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Workspace Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="My Workspace"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Workspace Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="my-workspace"
        />
        <p className="mt-1 text-xs text-slate-500">Lowercase letters, numbers, and hyphens only. Used in URLs.</p>
      </div>

      <div className="pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
