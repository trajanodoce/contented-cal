import { lazy, Suspense } from 'react';
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

// Lazy-loaded pages
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ListPage = lazy(() => import('./pages/ListPage').then(m => ({ default: m.ListPage })));
const BoardPage = lazy(() => import('./pages/BoardPage').then(m => ({ default: m.BoardPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const IntakeQueuePage = lazy(() => import('./pages/IntakeQueuePage').then(m => ({ default: m.IntakeQueuePage })));
const IntakeFormPage = lazy(() => import('./pages/IntakeFormPage').then(m => ({ default: m.IntakeFormPage })));
const MyWorkPage = lazy(() => import('./pages/MyWorkPage').then(m => ({ default: m.MyWorkPage })));
const AuthCallback = lazy(() => import('./components/auth/AuthCallback').then(m => ({ default: m.AuthCallback })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/list" replace />;
  }

  return <LoginPage />;
}

function CreateWorkspaceRoute() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading: workspaceLoading, currentWorkspace } = useWorkspace();

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has workspaces and one is selected, redirect to app
  if (workspaces.length > 0 && currentWorkspace) {
    return <Navigate to="/list" replace />;
  }

  return <CreateWorkspacePage />;
}

function ProtectedLayout() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading: workspaceLoading, currentWorkspace } = useWorkspace();

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
    return <Navigate to="/list" replace />;
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
      <Route path="/auth/callback" element={<Suspense fallback={<PageLoader />}><AuthCallback /></Suspense>} />
      <Route path="/intake/:slug" element={<Suspense fallback={<PageLoader />}><IntakeFormPage /></Suspense>} />
      <Route element={<ProtectedLayout />}>
        <Route path="/home" element={<Suspense fallback={<PageLoader />}><HomePage /></Suspense>} />
        <Route path="/list" element={<Suspense fallback={<PageLoader />}><ListPage /></Suspense>} />
        <Route path="/my-work" element={<Suspense fallback={<PageLoader />}><MyWorkPage /></Suspense>} />
        <Route path="/board" element={<Suspense fallback={<PageLoader />}><BoardPage /></Suspense>} />
        <Route path="/calendar" element={<Suspense fallback={<PageLoader />}><CalendarPage /></Suspense>} />
        <Route path="/projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
        <Route path="/projects/:projectId" element={<Suspense fallback={<PageLoader />}><ProjectDetailPage /></Suspense>} />
        <Route path="/intake-queue" element={<Suspense fallback={<PageLoader />}><IntakeQueuePage /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
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
                    position="top-right"
                    toastOptions={{
                      style: {
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
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
