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

// Layout and pages
import { AppLayout } from './layouts/AppLayout';
import { ListPage } from './pages/ListPage';
import { BoardPage } from './pages/BoardPage';
import { CalendarPage } from './pages/CalendarPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthCallback } from './components/auth/AuthCallback';

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
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/list" element={<ListPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
