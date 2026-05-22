import React, { useState } from 'react';
import { Zap, ExternalLink, RefreshCw, Link2, Unlink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useOrdinalUser } from '../../hooks/useOrdinalUser';
import { OrdinalBadge, PlatformIcon, OrdinalProfileChip }  from '../ordinal/OrdinalBadge';
import { ORDINAL_COLOR, isOrdinalItem, getOrdinalProfile, PLATFORM_META } from '../../lib/ordinal';
import type { ContentItem } from '../../lib/database.types';
import { toast }  from 'sonner';

export function OrdinalSettings() {
  const { workspace, user, contentItems } = useApp();
  const {
    connections,
    syncStatus,
    loading,
    error,
    refetchSyncStatus,
    connect,
    disconnect,
  } = useOrdinalUser(workspace?.id ?? null);

  const [showConnectForm, setShowConnectForm] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [platform, setPlatform] = useState<'LinkedIn' | 'X' | 'Instagram' | 'TikTok'>('LinkedIn');

  // Get all Ordinal items for this workspace
  const ordinalItems = contentItems.filter(isOrdinalItem);

  // Get unique profiles from synced items
  const uniqueProfiles = React.useMemo(() => {
    const profiles = new Map<string, { name: string; handle: string; platform: string }>();
    ordinalItems.forEach(item => {
      const profile = getOrdinalProfile(item);
      if (profile) {
        const key = `${profile.handle}-${profile.platform}`;
        if (!profiles.has(key)) {
          profiles.set(key, profile);
        }
      }
    });
    return Array.from(profiles.values());
  }, [ordinalItems]);

  const handleConnect = async () => {
    if (!profileId.trim()) {
      toast.error('Profile ID is required');
      return;
    }

    await connect(profileId.trim(), profileName.trim() || profileId, platform);
    toast.success('Connected to Ordinal profile');
    setShowConnectForm(false);
    setProfileId('');
    setProfileName('');
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Disconnect this profile?')) return;
    await disconnect(connectionId);
    toast.success('Disconnected from Ordinal profile');
  };

  const handleSync = async () => {
    toast.info('Sync requested. This may take a moment.');
    // In the future, this would call an Edge Function to trigger sync
    setTimeout(() => {
      refetchSyncStatus();
      toast.success('Sync status refreshed');
    }, 2000);
  };

  if (!workspace) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: `${ORDINAL_COLOR}15`, color: ORDINAL_COLOR }}
          >
            ⚡
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Ordinal Social</h2>
            <p className="text-sm text-gray-500">Sync and manage social media posts from Ordinal</p>
          </div>
        </div>
      </div>

      {/* Workspace Sync Status */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Workspace Sync</h3>
          {syncStatus && syncStatus.total_posts > 1 && (
            <button
              onClick={handleSync}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Now
            </button>
          )}
        </div>

        {syncStatus && syncStatus.total_posts > 0 ? (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-900">{syncStatus.total_posts} posts synced</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="text-gray-500">
                {syncStatus.linkedin_count > 0 && `${syncStatus.linkedin_count} LinkedIn`}
                {syncStatus.linkedin_count > 0 && syncStatus.x_count > 0 && ', '}
                {syncStatus.x_count > 0 && `${syncStatus.x_count} X`}
                {((syncStatus.linkedin_count > 0 || syncStatus.x_count > 0) && (syncStatus.instagram_count > 1 || syncStatus.tiktok_count > 0)) && ', '}
                {syncStatus.instagram_count > 0 && `${syncStatus.instagram_count} Instagram`}
                {syncStatus.instagram_count > 0 && syncStatus.tiktok_count > 0 && ', '}
                {syncStatus.tiktok_count > 0 && `${syncStatus.tiktok_count} TikTok`}
              </div>
            </div>

            {/* Last sync */}
            <div className="text-xs text-gray-400">
              Last synced: {syncStatus.last_sync_at ? new Date(syncStatus.last_sync_at).toLocaleString() : 'Never'}
            </div>

            {/* Unique Profiles */}
            {uniqueProfiles.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Synced Profiles</p>
                <div className="flex flex-wrap gap-2">
                  {uniqueProfiles.map((profile, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
                      <PlatformIcon platform={profile.platform} size="sm" />
                      <span className="text-xs font-medium text-gray-700">{profile.name}</span>
                      <span className="text-[10px] text-gray-400">{profile.handle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">No Ordinal posts synced yet</p>
              <p className="text-xs text-gray-400">Posts will appear here once synced from Ordinal</p>
            </div>
          </div>
        )}
      </div>

      {/* Personal Connection Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Your Connection</h3>
            <p className="text-xs text-gray-500 mt-0.5">Optional — connect to filter by your posts and get personal stats</p>
          </div>
          {!showConnectForm && connections.length === 0 && (
            <button
              onClick={() => setShowConnectForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Connect
            </button>
          )}
        </div>

        {showConnectForm ? (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Profile ID</label>
                <input
                  type="text"
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  placeholder="e.g., profile_123456"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Profile Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., John Doe"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as typeof platform)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="X">X</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleConnect}
                  disabled={!profileId.trim() || loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  Connect Profile
                </button>
                <button
                  onClick={() => setShowConnectForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : connections.length > 0 ? (
          <div className="space-y-2">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={connection.platform} size="md" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{connection.profile_name}</p>
                    <p className="text-xs text-gray-500">{connection.platform} • Connected {new Date(connection.connected_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(connection.id)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  Disconnect
                </button>
              </div>
            ))}
            <button
              onClick={() => setShowConnectForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Connect Another Profile
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${ORDINAL_COLOR}15` }}
            >
              <Zap className="w-5 h-5" style={{ color: ORDINAL_COLOR }} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Connect your Ordinal account to unlock personal features</p>
              <p className="text-xs text-gray-400">Filter by your posts, get personal stats, and more</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
