import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useViewPersistence } from '../contexts/ViewPersistenceContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { CreateItemModal } from '../components/content/CreateItemModal';
import { DetailSlideOver } from '../components/content/DetailSlideOver';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Calendar,
  Columns,
  List,
  Folder,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Calendar', icon: <Calendar className="w-5 h-5" />, path: '/calendar' },
  { label: 'Board', icon: <Columns className="w-5 h-5" />, path: '/board' },
  { label: 'List', icon: <List className="w-5 h-5" />, path: '/list' },
  { label: 'Projects', icon: <Folder className="w-5 h-5" />, path: '/projects' },
];

// Helper to get page title from current path
function getPageTitle(pathname: string): string {
  switch (pathname) {
    case '/list':
      return 'List View';
    case '/board':
      return 'Board View';
    case '/calendar':
      return 'Calendar View';
    case '/projects':
      return 'Projects';
    case '/settings':
      return 'Settings';
    default:
      return 'Content Calendar';
  }
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { currentWorkspace, switchWorkspace, workspaces } = useWorkspace();
  const { setLastUsedView } = useViewPersistence();
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Track view changes and save to persistence
  useEffect(() => {
    const path = location.pathname;
    const view = path.replace('/', '') as ViewType;
    if (['list', 'board', 'calendar', 'projects', 'settings'].includes(view)) {
      setLastUsedView(view);
    }
  }, [location.pathname, setLastUsedView]);

  // Handle view transitions
  const handleNavigation = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 150);
  }, []);

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out');
    navigate('/login');
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.user_metadata?.avatar_url;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 flex flex-col flex-shrink-0">
        {/* Workspace selector */}
        <div className="p-4 border-b border-slate-700">
          <button
            onClick={() => setShowWorkspacePicker(!showWorkspacePicker)}
            className="w-full flex items-center justify-between text-white hover:bg-slate-700 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="font-medium truncate">{currentWorkspace?.name || 'Select Workspace'}</span>
            <ChevronDown
              className={`w-4 h-4 flex-shrink-0 transition-transform ${showWorkspacePicker ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Workspace dropdown */}
          {showWorkspacePicker && workspaces.length > 1 && (
            <div className="mt-2 py-2 bg-slate-700 rounded-lg">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws);
                    setShowWorkspacePicker(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    currentWorkspace?.id === ws.id
                      ? 'text-white bg-slate-600'
                      : 'text-slate-300 hover:bg-slate-600 hover:text-white'
                  } transition-colors`}
                >
                  {ws.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavigation}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white border-l-2 border-blue-400'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <span className="text-slate-400">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Settings link (above user section) */}
        <div className="px-3 pb-2">
          <NavLink
            to="/settings"
            onClick={handleNavigation}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white border-l-2 border-blue-400'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`
            }
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span>Settings</span>
          </NavLink>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-slate-700" />

        {/* User section */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-sm font-medium">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-1">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-1 bg-slate-50 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <h1 className="text-lg font-semibold text-slate-900">
            {getPageTitle(location.pathname)}
          </h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Item
          </button>

          {/* Create Item Modal */}
          <CreateItemModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        </header>

        {/* Page content with fade transition */}
        <div
          className={`flex-1 overflow-auto transition-opacity duration-150 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <Outlet />
        </div>

        {/* Detail SlideOver Panel - Rendered at layout level */}
        <ItemDetailPanelWrapper />

        {/* Floating Action Button - visible on all views */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-50"
          aria-label="Create new item"
          title="Create new item"
        >
          <Plus className="w-6 h-6" />
        </button>
      </main>
    </div>
  );
}

// Wrapper component to fetch item data when selectedItemId changes
function ItemDetailPanelWrapper() {
  const { selectedItemId, selectedItem, setSelectedItem, closePanel } = useSelectedItem();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);

  // Fetch item data when selectedItemId changes
  useEffect(() => {
    if (!selectedItemId || !currentWorkspace) {
      return;
    }

    // If we already have the full item from context, use it
    if (selectedItem && selectedItem.id === selectedItemId) {
      return;
    }

    // Otherwise fetch the item
    setLoading(true);
    supabase
      .from('content_items')
      .select('*')
      .eq('id', selectedItemId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load item');
          closePanel();
        } else if (data) {
          setSelectedItem(data);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedItemId, currentWorkspace, selectedItem, setSelectedItem, closePanel]);

  if (!selectedItemId || !selectedItem) {
    return null;
  }

  return (
    <DetailSlideOver
      item={selectedItem}
      onClose={closePanel}
      onUpdated={() => {
        // Trigger a refetch of content items
        // This will be handled by the individual pages' refetch functions
        closePanel();
      }}
      addToast={(msg, type = 'success') => {
        if (type === 'error') toast.error(msg);
        else toast.success(msg);
      }}
    />
  );
}
