import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Building2, Loader2, LogOut, ArrowLeft, User } from 'lucide-react';

export function CreateWorkspacePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { createWorkspace, loading: contextLoading, workspaces } = useWorkspace();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.user_metadata?.avatar_url;
  const hasWorkspaces = workspaces.length > 0;

  // Auto-generate slug from name
  const generateSlug = useCallback((text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    setSlug(generateSlug(newName));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSlug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    setSlug(newSlug);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setLoading(true);
    try {
      const { workspace, error } = await createWorkspace(name.trim(), slug.trim());

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('slug')) {
          toast.error('A workspace with this URL slug already exists. Try a different name.');
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }

      if (workspace) {
        toast.success('Workspace created!');
        navigate('/list');
      }
    } catch (err) {
      toast.error('Failed to create workspace. Please try again.');
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out');
    navigate('/login');
  }

  const isBusy = loading || contextLoading;

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Top bar with user info */}
      <header className="bg-surface-card border-b border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {hasWorkspaces && (
              <Link
                to="/list"
                className="flex items-center gap-2 text-sm font-medium text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#0B2763' }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to workspace
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
              )}
              <div className="text-sm">
                <p className="font-medium text-slate-900">{userName}</p>
                <p className="text-slate-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-[#005D9710] rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex items-center justify-center p-4 pt-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <img src="/assets/logo.png" alt="ContentedCal" className="w-16 h-16 mx-auto mb-2 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Create your workspace</h1>
            <p className="text-slate-500 text-sm mt-1">
              Workspaces help you organize your content with your team.
            </p>
          </div>

          {/* Form */}
          <div className="bg-surface-card rounded-2xl shadow-sm p-8" style={{ border: '1px solid #00233930' }}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Workspace name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="Acme Marketing"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-slate-700 mb-1.5">
                  URL slug
                </label>
                <div className="flex items-center">
                  <span className="text-slate-500 text-sm px-3 py-2.5 bg-surface-nested border-y border-l border-slate-200 rounded-l-lg">
                    /w/
                  </span>
                  <input
                    type="text"
                    id="slug"
                    value={slug}
                    onChange={handleSlugChange}
                    placeholder="acme-marketing"
                    className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent focus:z-10 transition-colors"
                    required
                    pattern="[a-z0-9-]+"
                    title="Only lowercase letters, numbers, and hyphens"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Only lowercase letters, numbers, and hyphens. Auto-generated from name.
                </p>
              </div>

              <button
                type="submit"
                disabled={isBusy || !name.trim() || !slug.trim()}
                className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                Create workspace
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
