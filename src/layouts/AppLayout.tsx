import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useViewPersistence, type ViewType } from '../contexts/ViewPersistenceContext';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { CreateItemModal } from '../components/content/CreateItemModal';
import { DetailSlideOver } from '../components/content/DetailSlideOver';
import { Avatar } from '../components/ui/Avatar';
import { AvatarUploadModal } from '../components/ui/AvatarUploadModal';
import { useUserAlerts } from '../hooks/useUserAlerts';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Calendar,
  Columns,
  List,
  Folder,
  Inbox,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  CircleUser,
  LayoutDashboard,
  Palette,
  FileText,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Home', icon: <LayoutDashboard className="w-5 h-5" />, path: '/home' },
  { label: 'Calendar', icon: <Calendar className="w-5 h-5" />, path: '/calendar' },
  { label: 'Board', icon: <Columns className="w-5 h-5" />, path: '/board' },
  { label: 'List', icon: <List className="w-5 h-5" />, path: '/list' },
  { label: 'My Work', icon: <CircleUser className="w-5 h-5" />, path: '/my-work' },
  { label: 'Projects', icon: <Folder className="w-5 h-5" />, path: '/projects' },
  { label: 'Intake Queue', icon: <Inbox className="w-5 h-5" />, path: '/intake-queue' },
];

// Helper to get page title from current path
function getPageTitle(pathname: string): string {
  switch (pathname) {
    case '/home':
      return 'Home';
    case '/list':
      return 'List View';
    case '/board':
      return 'Board View';
    case '/calendar':
      return 'Calendar View';
    case '/projects':
      return 'Projects';
    case '/intake-queue':
      return 'Intake Queue';
    case '/my-work':
      return 'My Work';
    case '/settings':
      return 'Settings';
    default:
      if (pathname.startsWith('/projects/')) return 'Project Detail';
      return 'Content Calendar';
  }
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { currentWorkspace, switchWorkspace, workspaces, userRole } = useWorkspace();
  const { setLastUsedView } = useViewPersistence();
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTags, setModalTags] = useState<string[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const fabMenuRef = useRef<HTMLDivElement>(null);
  const { selectedItemId, setSelectedItemId } = useSelectedItem();
  const { unreadCount: unreadAlertCount } = useUserAlerts();
  const canCreate = userRole === 'admin' || userRole === 'editor';
  const canAccessSettings = userRole === 'admin';
  const urlSyncRef = useRef(false);

  // Track view changes and save to persistence
  useEffect(() => {
    const path = location.pathname;
    const view = path.replace('/', '') as ViewType;
    if (['home', 'list', 'board', 'calendar', 'projects', 'intake-queue', 'my-work', 'settings'].includes(view)) {
      setLastUsedView(view);
    }
  }, [location.pathname, setLastUsedView]);

  // URL ↔ selected item sync: read ?item= on mount/navigation
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get('item');
    if (itemId && itemId !== selectedItemId) {
      urlSyncRef.current = true;
      setSelectedItemId(itemId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // URL ↔ selected item sync: write ?item= when selection changes
  useEffect(() => {
    if (urlSyncRef.current) {
      urlSyncRef.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const currentParam = params.get('item');

    if (selectedItemId && currentParam !== selectedItemId) {
      params.set('item', selectedItemId);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    } else if (!selectedItemId && currentParam) {
      params.delete('item');
      const search = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  // Close create menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
      if (fabMenuRef.current && !fabMenuRef.current.contains(e.target as Node)) {
        setShowFabMenu(false);
      }
    }
    if (showCreateMenu || showFabMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCreateMenu, showFabMenu]);

  // Handle view transitions (no-op — transitions now handled by Suspense)
  const handleNavigation = useCallback(() => {}, []);

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out');
    navigate('/login');
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Load avatar: prefer profiles table, fall back to auth metadata
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle();
      setAvatarUrl(data?.avatar_url || user.user_metadata?.avatar_url || null);
    })();
  }, [user]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;

    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `avatars/${user.id}.${ext}`;

      // Remove old avatar files
      try {
        await supabase.storage.from('workspace-assets').remove([
          `avatars/${user.id}.png`, `avatars/${user.id}.jpg`,
          `avatars/${user.id}.jpeg`, `avatars/${user.id}.webp`,
        ]);
      } catch { /* non-critical */ }

      const { error: uploadError } = await supabase.storage
        .from('workspace-assets')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        toast.error('Failed to upload avatar: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage.from('workspace-assets').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (profileErr) {
        toast.error('Failed to save avatar: ' + profileErr.message);
        return;
      }

      // Update auth metadata so it reflects immediately everywhere
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

      setAvatarUrl(publicUrl);
      toast.success('Avatar updated!');
      setUploadModalOpen(false);
    } catch (err) {
      toast.error('Something went wrong uploading avatar');
      console.error(err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-page">
      {/* Sidebar — Navy Gradient (Option B) */}
      <aside className="w-64 flex flex-col flex-shrink-0" style={{ background: 'linear-gradient(to bottom, #002339, #003d66)' }}>
        {/* Logo + Workspace selector */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <img src="/assets/kitsune-logo.png" alt="ContentedCal" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-heading text-white text-sm tracking-wide">ContentedCal</span>
          </div>
          <button
            onClick={() => setShowWorkspacePicker(!showWorkspacePicker)}
            className="w-full flex items-center gap-2.5 text-white hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
          >
            {currentWorkspace?.logo_url ? (
              <img src={currentWorkspace.logo_url} alt="" className="w-6 h-6 rounded shrink-0 object-cover" />
            ) : (
              <div className="w-6 h-6 rounded bg-white/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">{currentWorkspace?.name?.charAt(0)?.toUpperCase() ?? 'W'}</span>
              </div>
            )}
            <span className="font-medium truncate flex-1 text-left text-sm">{currentWorkspace?.name || 'Select Workspace'}</span>
            <ChevronDown
              className={`w-4 h-4 flex-shrink-0 transition-transform opacity-60 ${showWorkspacePicker ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Workspace dropdown */}
          {showWorkspacePicker && workspaces.length > 1 && (
            <div className="mt-2 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws);
                    setShowWorkspacePicker(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm ${
                    currentWorkspace?.id === ws.id
                      ? 'text-white bg-white/15'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  } transition-colors`}
                >
                  {ws.logo_url ? (
                    <img src={ws.logo_url} alt="" className="w-5 h-5 rounded shrink-0 object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded bg-white/15 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-white">{ws.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const showAlertDot = item.path === '/my-work' && unreadAlertCount > 0;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavigation}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: 'linear-gradient(135deg, rgba(251,231,241,0.25) 0%, rgba(251,231,241,0.08) 100%)', borderLeft: '2px solid #FBE7F1' }
                    : undefined
                }
              >
                <span className={`opacity-70`}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {showAlertDot && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: '#BA2C2C' }}
                    aria-label={`${unreadAlertCount} unread alert${unreadAlertCount === 1 ? '' : 's'}`}
                  >
                    {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Settings link (above user section) — admin only */}
        {canAccessSettings && (
          <div className="px-3 pb-2">
            <NavLink
              to="/settings"
              onClick={handleNavigation}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { background: 'linear-gradient(135deg, rgba(251,231,241,0.25) 0%, rgba(251,231,241,0.08) 100%)', borderLeft: '2px solid #FBE7F1' }
                  : undefined
              }
            >
              <Settings className="w-5 h-5 opacity-70" />
              <span>Settings</span>
            </NavLink>
          </div>
        )}

        {/* Divider */}
        <div className="mx-4 border-t border-white/10" />

        {/* User section */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              src={avatarUrl}
              name={userName}
              size="lg"
              editable
              uploading={isUploadingAvatar}
              onEditClick={() => setUploadModalOpen(true)}
            />
            <div className="flex-1 min-w-1">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Avatar upload modal — top-level so it's not constrained by the sidebar flex layout */}
      <AvatarUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSave={handleAvatarUpload}
        currentAvatarUrl={avatarUrl}
        currentName={userName}
        uploading={isUploadingAvatar}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-1 bg-surface-page overflow-hidden relative">
        {/* Header */}
        <header
          className="cc-banner-page-header h-16 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1.5px solid #002339' }}
        >
          <h1 className="text-lg font-heading" style={{ color: '#002339' }}>
            {getPageTitle(location.pathname)}
          </h1>
          {canCreate && (
            <div className="relative" ref={createMenuRef}>
              <button
                onClick={() => setShowCreateMenu(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>
              {showCreateMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-surface-card rounded-xl shadow-lg py-1.5 z-50" style={{ border: '1px solid #00233930' }}>
                  <button
                    onClick={() => { setShowCreateMenu(false); setModalTags([]); setIsModalOpen(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-surface-nested transition-colors"
                  >
                    <FileText className="w-4 h-4 text-brand-600" />
                    Content Item
                  </button>
                  <button
                    onClick={() => { setShowCreateMenu(false); setModalTags(['design-request']); setIsModalOpen(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-surface-nested transition-colors"
                  >
                    <Palette className="w-4 h-4 text-accent-lavender" />
                    Design Request
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Create Item Modal */}
          {canCreate && (
            <CreateItemModal
              isOpen={isModalOpen}
              onClose={() => { setIsModalOpen(false); setModalTags([]); }}
              initialProjectId={location.pathname.startsWith('/projects/') ? location.pathname.split('/projects/')[1] : null}
              initialTags={modalTags}
            />
          )}
        </header>

        {/* Page content with fade transition */}
        <div className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </div>

        {/* Detail SlideOver Panel - Rendered at layout level */}
        <ItemDetailPanelWrapper />

        {/* Floating Action Button - visible for editors and admins, hidden when detail panel is open */}
        {canCreate && !selectedItemId && (
          <div className="fixed bottom-6 right-6 z-50" ref={fabMenuRef}>
            {showFabMenu && (
              <div className="absolute bottom-16 right-0 w-52 bg-surface-card rounded-xl shadow-lg py-1.5 mb-2" style={{ border: '1px solid #00233930' }}>
                <button
                  onClick={() => { setShowFabMenu(false); setModalTags([]); setIsModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-surface-nested transition-colors"
                >
                  <FileText className="w-4 h-4 text-brand-600" />
                  Content Item
                </button>
                <button
                  onClick={() => { setShowFabMenu(false); setModalTags(['design-request']); setIsModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-surface-nested transition-colors"
                >
                  <Palette className="w-4 h-4 text-accent-lavender" />
                  Design Request
                </button>
              </div>
            )}
            <button
              onClick={() => setShowFabMenu(v => !v)}
              className={`w-14 h-14 bg-brand-600 hover:bg-brand-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${showFabMenu ? 'rotate-45' : ''}`}
              aria-label="Create new item"
              title="Create new item"
            >
              <Plus className="w-6 h-6 transition-transform" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// Wrapper component to fetch item data when selectedItemId changes
function ItemDetailPanelWrapper() {
  const { selectedItemId, selectedItem, setSelectedItem, closePanel } = useSelectedItem();
  const { currentWorkspace } = useWorkspace();
  const [, setLoading] = useState(false);

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
        setLoading(false);
      });
  }, [selectedItemId, currentWorkspace, selectedItem, setSelectedItem, closePanel]);

  if (!selectedItemId || !selectedItem) {
    return null;
  }

  return (
    <DetailSlideOver
      item={selectedItem}
      onClose={closePanel}
      onUpdated={() => {
        // Re-fetch the item to reflect changes without closing the panel
        if (selectedItemId) {
          supabase
            .from('content_items')
            .select('*')
            .eq('id', selectedItemId)
            .single()
            .then(({ data }) => {
              if (data) setSelectedItem(data);
            });
        }
      }}
      addToast={(msg, type = 'success') => {
        if (type === 'error') toast.error(msg);
        else toast.success(msg);
      }}
    />
  );
}
