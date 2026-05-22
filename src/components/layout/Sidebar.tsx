import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar, Kanban, List, FolderOpen, Settings,
  LogOut, ChevronDown, Calendar as CalIcon, Inbox, User, Bug, Check, Plus
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

type View = 'calendar' | 'board' | 'list' | 'projects' | 'intake' | 'my-work' | 'settings' | 'debug';

interface Props {
  activeView: View;
  onViewChange: (view: View) => void;
}

const navItems: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'board', label: 'Board', icon: Kanban },
  { id: 'list', label: 'List', icon: List },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'intake', label: 'Intake Queue', icon: Inbox },
  { id: 'my-work', label: 'My Work', icon: User },
];

export function Sidebar({ activeView, onViewChange }: Props) {
  const { workspace, workspaces, user, setWorkspace, signOut } = useApp();
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false);
      }
    }
    if (wsDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wsDropdownOpen]);

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <aside className="w-60 bg-brand-600 flex flex-col h-full shrink-0">
      {/* Logo / workspace */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <CalIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm truncate">ContentCal</span>
        </div>

        <div className="relative mt-2" ref={dropdownRef}>
          <button
            onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-500 transition-colors group"
          >
            <span className="text-xs text-brand-100 truncate flex-1 text-left">{workspace?.name ?? 'My Workspace'}</span>
            <ChevronDown className={`w-3 h-3 text-brand-300 shrink-0 transition-transform ${wsDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {wsDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-64 overflow-y-auto">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setWorkspace(ws);
                    setWsDropdownOpen(false);
                    const currentView = window.location.pathname.match(/^\/w\/[^/]+\/([^/]+)/)?.[1] ?? 'list';
                    window.history.pushState({}, '', `/w/${ws.slug}/${currentView}`);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="truncate flex-1">{ws.name}</span>
                  {ws.id === workspace?.id && (
                    <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-medium text-brand-300 uppercase tracking-wider px-2 mb-2 mt-1">Views</p>
        {navItems.map(item => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors
                ${active
                  ? 'bg-mint text-brand-600 font-medium'
                  : 'text-brand-100 hover:text-white hover:bg-brand-500'
                }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {active && item.id === 'list' && (
                <span className="ml-auto text-xs bg-brand-600/20 text-brand-600 px-1.5 py-0.5 rounded-md">Active</span>
              )}
            </button>
          );
        })}

        <div className="pt-3 mt-3 border-t border-brand-500">
          <p className="text-xs font-medium text-brand-300 uppercase tracking-wider px-2 mb-2">Workspace</p>
          <button
            onClick={() => onViewChange('settings')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors
              ${activeView === 'settings'
                ? 'bg-mint text-brand-600 font-medium'
                : 'text-brand-100 hover:text-white hover:bg-brand-500'
              }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => onViewChange('debug')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors
              ${activeView === 'debug'
                ? 'bg-mint text-brand-600 font-medium'
                : 'text-brand-100 hover:text-white hover:bg-brand-500'
              }`}
          >
            <Bug className="w-4 h-4 shrink-0" />
            <span>Debug</span>
          </button>
        </div>
      </nav>

      {/* User */}
      <div className="px-3 pb-4 border-t border-brand-500 pt-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-brand-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User'}
            </p>
            <p className="text-xs text-brand-300 truncate">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="shrink-0 text-brand-300 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
