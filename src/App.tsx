import { lazy, Suspense, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { AppProvider } from './contexts/AppContext';
import { FiltersProvider } from './contexts/FiltersContext';
import { ViewPersistenceProvider, useViewPersistence } from './contexts/ViewPersistenceContext';
import { SelectedItemProvider } from './contexts/SelectedItemContext';

// Inner component to get workspace for FiltersProvider
function AppWithFilters({ children }: { children: React.ReactNode }) {
  const { currentWorkspace } = useWorkspace();
  return (
    <FiltersProvider workspaceId={currentWorkspace?.id || null}>
      {children}
    </FiltersProvider>
  );
}
import { LoginPage } from './pages/LoginPage';
import { CreateWorkspacePage } from './pages/CreateWorkspacePage';
import { Loader2 } from 'lucide-react';

// Layout (always loaded)
import { AppLayout } from './layouts/AppLayout';

// Retry wrapper for lazy imports — handles stale chunks after deploys
function lazyRetry<T extends { default: React.ComponentType }>(
  importer: () => Promise<T>,
  retries = 2
): Promise<T> {
  return importer().catch((error: unknown) => {
    if (retries > 0) {
      // Clear module cache and retry after a brief delay
      return new Promise<T>(resolve =>
        setTimeout(() => resolve(lazyRetry(importer, retries - 1)), 500)
      );
    }
    throw error;
  });
}

// Error boundary — catches chunk load failures and auto-reloads
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // If it's a chunk load error, reload the page once
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module');

    if (isChunkError) {
      const reloadKey = 'chunk_reload_ts';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      // Only auto-reload if we haven't reloaded in the last 10 seconds
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
          <p className="text-sm text-slate-500">Something went wrong loading this page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded pages with retry
const HomePage = lazy(() => lazyRetry(() => import('./pages/HomePage').then(m => ({ default: m.HomePage }))));
const ListPage = lazy(() => lazyRetry(() => import('./pages/ListPage').then(m => ({ default: m.ListPage }))));
const BoardPage = lazy(() => lazyRetry(() => import('./pages/BoardPage').then(m => ({ default: m.BoardPage }))));
const CalendarPage = lazy(() => lazyRetry(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage }))));
const ProjectsPage = lazy(() => lazyRetry(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage }))));
const ProjectDetailPage = lazy(() => lazyRetry(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage }))));
const SettingsPage = lazy(() => lazyRetry(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage }))));
const IntakeQueuePage = lazy(() => lazyRetry(() => import('./pages/IntakeQueuePage').then(m => ({ default: m.IntakeQueuePage }))));
const IntakeFormPage = lazy(() => lazyRetry(() => import('./pages/IntakeFormPage').then(m => ({ default: m.IntakeFormPage }))));
const MyWorkPage = lazy(() => lazyRetry(() => import('./pages/MyWorkPage').then(m => ({ default: m.MyWorkPage }))));
const DesignRequestPage = lazy(() => lazyRetry(() => import('./pages/DesignRequestPage').then(m => ({ default: m.DesignRequestPage }))));
const AuthCallback = lazy(() => lazyRetry(() => import('./components/auth/AuthCallback').then(m => ({ default: m.AuthCallback }))));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <LoginPage />;
}

function CreateWorkspaceRoute() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading: workspaceLoading, currentWorkspace } = useWorkspace();

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has workspaces and one is selected, redirect to app
  if (workspaces.length > 0 && currentWorkspace) {
    return <Navigate to="/home" replace />;
  }

  return <CreateWorkspacePage />;
}

function ProtectedLayout() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading: workspaceLoading, currentWorkspace } = useWorkspace();

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (workspaces.length === 1) {
    return <AppLayout />;
  }

  if (workspaces.length > 1 && !currentWorkspace) {
    return <Navigate to="/home" replace />;
  }

  if (workspaces.length === 0) {
    return <Navigate to="/create-workspace" replace />;
  }

  return <AppLayout />;
}

// Component that handles redirecting to last used view
function LastViewRedirect() {
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const { lastUsedView } = useViewPersistence();

  // Only redirect if we're at the root path and have a valid lastUsedView
  if (location.pathname === '/' && currentWorkspace && lastUsedView) {
    return <Navigate to={`/${lastUsedView}`} replace />;
  }

  // Default to list if no last view
  return <Navigate to="/list" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/create-workspace" element={<CreateWorkspaceRoute />} />
      <Route path="/auth/callback" element={<LazyPage><AuthCallback /></LazyPage>} />
      <Route path="/intake/:slug" element={<LazyPage><IntakeFormPage /></LazyPage>} />
      <Route element={<ProtectedLayout />}>
        <Route path="/home" element={<LazyPage><HomePage /></LazyPage>} />
        <Route path="/list" element={<LazyPage><ListPage /></LazyPage>} />
        <Route path="/my-work" element={<LazyPage><MyWorkPage /></LazyPage>} />
        <Route path="/board" element={<LazyPage><BoardPage /></LazyPage>} />
        <Route path="/calendar" element={<LazyPage><CalendarPage /></LazyPage>} />
        <Route path="/projects" element={<LazyPage><ProjectsPage /></LazyPage>} />
        <Route path="/projects/:projectId" element={<LazyPage><ProjectDetailPage /></LazyPage>} />
        <Route path="/intake-queue" element={<LazyPage><IntakeQueuePage /></LazyPage>} />
        <Route path="/design-request" element={<LazyPage><DesignRequestPage /></LazyPage>} />
        <Route path="/settings" element={<LazyPage><SettingsPage /></LazyPage>} />
        <Route path="/" element={<LastViewRedirect />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppProvider>
          <AppWithFilters>
            <ViewPersistenceProvider>
              <SelectedItemProvider>
                <BrowserRouter>
                  <AppRoutes />
                  <Toaster
                    position="bottom-right"
                    toastOptions={{
                      style: {
                        background: '#F7F9FC',
                        border: '1px solid #00233930',
                        borderRadius: '8px',
                        padding: '10px 14px',
                      },
                      classNames: {
                        success: 'cc-toast-success',
                        error: 'cc-toast-error',
                        warning: 'cc-toast-warning',
                        info: 'cc-toast-info',
                      },
                    }}
                  />
                </BrowserRouter>
              </SelectedItemProvider>
            </ViewPersistenceProvider>
          </AppWithFilters>
        </AppProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
