import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { toast } from 'sonner';
import { GeneralTab } from '../components/settings/GeneralTab';
import { TeamTab } from '../components/settings/TeamTab';
import { CustomizationsTab } from '../components/settings/CustomizationsTab';
import { IntakeFormsList } from '../components/settings/IntakeFormBuilder';
import { IntegrationsPage } from '../components/settings/IntegrationsPage';
import { ApiKeysTab } from '../components/settings/ApiKeysTab';
import {
  Settings, Users, Inbox, Zap, Key, AlertTriangle, Palette,
} from 'lucide-react';
import SettingsTabs from '../components/ui/SettingsTabs';

const OLD_CUSTOMIZATION_SLUGS = [
  'content-types', 'channels', 'custom-fields', 'board-columns', 'subtask-templates',
] as const;

type TopTab = 'general' | 'team' | 'customizations' | 'intake-forms' | 'integrations' | 'api';

function resolveTab(pathname: string): { topTab: TopTab; redirect?: string } {
  const segments = pathname.replace(/^\/settings\/?/, '').split('/').filter(Boolean);
  const first = segments[0] || 'general';

  if (OLD_CUSTOMIZATION_SLUGS.includes(first as typeof OLD_CUSTOMIZATION_SLUGS[number])) {
    return { topTab: 'customizations', redirect: `/settings/customizations/${first}` };
  }

  if (first === 'customizations') return { topTab: 'customizations' };

  const valid: TopTab[] = ['general', 'team', 'intake-forms', 'integrations', 'api'];
  if (valid.includes(first as TopTab)) return { topTab: first as TopTab };

  return { topTab: 'general', redirect: '/settings/general' };
}

export function SettingsPage() {
  const { currentWorkspace, userRole } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const { topTab, redirect } = resolveTab(location.pathname);

  useEffect(() => {
    if (redirect) {
      navigate(redirect, { replace: true });
    }
  }, [redirect, navigate]);

  if (redirect) return null;

  if (userRole !== 'admin') {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-500">Only workspace admins can access settings.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleTabChange = (id: string) => {
    if (id === 'customizations') {
      navigate('/settings/customizations/content-types');
    } else {
      navigate(`/settings/${id}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-display text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your workspace configuration</p>
      </div>

      <div className="mb-6">
        <SettingsTabs
          tabs={[
            { id: 'general', label: 'General', icon: <Settings className="w-3.5 h-3.5" /> },
            { id: 'team', label: 'Team', icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'customizations', label: 'Customizations', icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'intake-forms', label: 'Intake Forms', icon: <Inbox className="w-3.5 h-3.5" /> },
            { id: 'integrations', label: 'Integrations', icon: <Zap className="w-3.5 h-3.5" /> },
            { id: 'api', label: 'API', icon: <Key className="w-3.5 h-3.5" /> },
          ]}
          activeTab={topTab}
          onTabChange={handleTabChange}
        />
      </div>

      {topTab === 'customizations' ? (
        <CustomizationsTab workspaceId={currentWorkspace?.id || null} />
      ) : (
        <div className="bg-surface-card rounded-lg p-6" style={{ border: '1px solid #00233930' }}>
          {topTab === 'general' && <GeneralTab workspace={currentWorkspace} />}
          {topTab === 'team' && <TeamTab />}
          {topTab === 'intake-forms' && <IntakeFormsList addToast={(msg, type = 'success') => { if (type === 'error') toast.error(msg); else toast.success(msg); }} />}
          {topTab === 'integrations' && <IntegrationsPage addToast={(msg, type = 'success') => { if (type === 'error') toast.error(msg); else toast.success(msg); }} />}
          {topTab === 'api' && <ApiKeysTab workspaceId={currentWorkspace?.id || null} />}
        </div>
      )}
    </div>
  );
}
