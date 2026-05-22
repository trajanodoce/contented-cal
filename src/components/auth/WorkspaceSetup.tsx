import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { Building2, Loader2, LogOut } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function WorkspaceSetup({ addToast }: Props) {
  const { user, setWorkspace } = useApp();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Verify session is active before attempting workspace creation
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        addToast('Your session has expired. Please sign in again.', 'error');
        window.location.href = '/auth';
        return;
      }

      const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);

      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .insert({ name, slug })
        .select()
        .single();

      if (wsError) throw wsError;

      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: ws.id, user_id: user.id, role: 'admin' });

      if (memberError) throw memberError;

      addToast(`Workspace "${name}" created!`);
      setWorkspace(ws);
      window.history.replaceState({}, '', `/w/${ws.slug}/list`);
    } catch (err: unknown) {
      addToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-2xl mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your workspace</h1>
          <p className="text-gray-500 text-sm mt-1">This is where your team's content lives.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Workspace name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                placeholder="Acme Marketing"
                required
              />
              <p className="text-xs text-gray-400 mt-1">This is usually your company or team name.</p>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create workspace
            </button>

            <div className="pt-4 mt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
