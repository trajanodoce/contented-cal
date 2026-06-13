import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Loader2, LogOut, User, RefreshCw, MailQuestion } from 'lucide-react';

export function WelcomePage() {
  const { user, signOut } = useAuth();
  const { refreshWorkspaces } = useWorkspace();
  const [checking, setChecking] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';
  const userAvatar = user?.user_metadata?.avatar_url;

  async function handleCheckAgain() {
    setChecking(true);
    try {
      // If access was granted, the /welcome route guard redirects into the app automatically.
      await refreshWorkspaces();
      toast.message('No access yet. We will let you in as soon as an admin approves you.');
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out');
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/assets/logo.png" alt="ContentedCal" className="w-16 h-16 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-slate-900">Almost there</h1>
          <p className="text-slate-500 text-sm mt-1">Your account is not on a workspace yet.</p>
        </div>

        <div
          className="bg-surface-card rounded-2xl shadow-sm p-8 text-center"
          style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}
        >
          <div className="w-12 h-12 rounded-full bg-brand-600/[0.094] flex items-center justify-center mx-auto mb-4">
            <MailQuestion className="w-6 h-6 text-brand-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Ask an admin to invite you</h2>
          <p className="text-sm text-slate-500 mt-2">
            A workspace admin needs to approve your access. You show up in their team list automatically, and the moment they add you, you are in.
          </p>

          <div className="flex items-center justify-center gap-3 mt-6 p-3 rounded-lg bg-surface-nested">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-500" />
              </div>
            )}
            <div className="text-left text-sm">
              <p className="font-medium text-slate-900">{userName}</p>
              <p className="text-slate-500">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleCheckAgain}
            disabled={checking}
            className="w-full mt-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Check again
          </button>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
