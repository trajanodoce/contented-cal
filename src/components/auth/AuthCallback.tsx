import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Prevent double processing due to React StrictMode
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    async function handleCallback() {
      try {
        // Check for OAuth errors first
        const url = new URL(window.location.href);
        const errorCode = url.searchParams.get('error');
        const errorDesc = url.searchParams.get('error_description');

        if (errorCode) {
          throw new Error(`OAuth error: ${errorCode} - ${errorDesc || 'Unknown error'}`);
        }

        // Set up auth state listener

        // eslint-disable-next-line prefer-const -- reassigned via closure at line below
        let timeoutId: ReturnType<typeof setTimeout>;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            clearTimeout(timeoutId);
            subscription.unsubscribe();

            // Wait for AuthContext to update its user state before navigating
            setTimeout(() => {
              toast.success('Signed in successfully!');

              // Clean up the URL
              window.history.replaceState({}, '', '/auth/callback');

              const returnTo = localStorage.getItem('authReturnTo');
              localStorage.removeItem('authReturnTo');

              const redirectTo = returnTo && returnTo !== '/login' && returnTo !== '/auth/callback'
                ? returnTo
                : '/home';

              navigate(redirectTo, { replace: true });
            }, 1000); // 1 second delay to ensure AuthContext has updated
          }
        });

        // Set a timeout in case the auth state change never fires
        timeoutId = setTimeout(() => {
          // Auth state listener timed out — try one final session check
          subscription.unsubscribe();

          // One last check for session
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              // Found session on timeout check
              toast.success('Signed in successfully!');

              const returnTo = localStorage.getItem('authReturnTo');
              localStorage.removeItem('authReturnTo');
              const redirectTo = returnTo && returnTo !== '/login' && returnTo !== '/auth/callback'
                ? returnTo
                : '/home';

              navigate(redirectTo, { replace: true });
            } else {
              setError('Session could not be established. Please try again.');
              toast.error('Session could not be established. Please try again.');
              setTimeout(() => navigate('/login', { replace: true }), 2000);
            }
          });
        }, 5000);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
        console.error('[AuthCallback] Error:', errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    }

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <div className="text-center bg-surface-card p-8 rounded-xl shadow-sm" style={{ border: '1px solid rgb(var(--color-brand-900) / 0.188)' }}>
          <p className="text-sm text-accent-crimson mb-2 font-medium">Authentication failed</p>
          <p className="text-xs text-slate-500">{error}</p>
          <p className="text-xs text-slate-400 mt-4">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Completing sign in...</p>
      </div>
    </div>
  );
}