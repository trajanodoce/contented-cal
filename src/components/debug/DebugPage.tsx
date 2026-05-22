import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Database, Shield, Plug, Zap, ChevronDown, ChevronUp, Terminal,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type Status = 'pass' | 'fail' | 'warn' | 'loading' | 'idle';

interface CheckResult {
  label: string;
  status: Status;
  detail?: string;
  extra?: string;
}

// ── Status icon ────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: Status }) {
  if (status === 'loading') return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <div className="w-4 h-4 rounded-full bg-gray-200" />;
}

function CheckRow({ check }: { check: CheckResult }) {
  const [open, setOpen] = useState(false);
  const statusBg = {
    pass: 'bg-green-50 border-green-100',
    fail: 'bg-red-50 border-red-100',
    warn: 'bg-amber-50 border-amber-100',
    loading: 'bg-gray-50 border-gray-100',
    idle: 'bg-gray-50 border-gray-100',
  }[check.status];

  return (
    <div className={`border rounded-lg overflow-hidden ${statusBg}`}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
        onClick={() => check.detail && setOpen(o => !o)}
      >
        <StatusIcon status={check.status} />
        <span className="text-sm font-medium text-gray-800 flex-1">{check.label}</span>
        {check.extra && <span className="text-xs text-gray-500 font-mono">{check.extra}</span>}
        {check.detail && (open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />)}
      </div>
      {open && check.detail && (
        <div className="px-4 pb-3 border-t border-current/10">
          <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap mt-2 leading-relaxed">{check.detail}</pre>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, checks, running }: { title: string; icon: React.ElementType; checks: CheckResult[]; running: boolean }) {
  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {running && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {passCount > 0 && <span className="text-green-600 font-medium">{passCount} pass</span>}
          {warnCount > 0 && <span className="text-amber-600 font-medium">{warnCount} warn</span>}
          {failCount > 0 && <span className="text-red-600 font-medium">{failCount} fail</span>}
        </div>
      </div>
      <div className="p-4 space-y-2">
        {checks.map((c, i) => <CheckRow key={i} check={c} />)}
        {checks.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No checks yet</p>
        )}
      </div>
    </div>
  );
}

// ── Seed data ──────────────────────────────────────────────────────────────────

async function seedTestData(workspaceId: string, userId: string, contentTypes: { id: string; name: string }[], boardColumns: { id: string; name: string }[]): Promise<string[]> {
  const logs: string[] = [];

  const ctId = (name: string) => contentTypes.find(c => c.name.toLowerCase().includes(name.toLowerCase()))?.id ?? contentTypes[0]?.id ?? null;
  const colId = (name: string) => boardColumns.find(c => c.name.toLowerCase().includes(name.toLowerCase()))?.id ?? boardColumns[0]?.id ?? null;

  const today = new Date();
  const d = (offset: number) => new Date(today.getTime() + offset * 86400000).toISOString().split('T')[0];

  // Insert 2 projects
  const { data: projects, error: projErr } = await supabase.from('projects').insert([
    { workspace_id: workspaceId, title: 'Q3 Product Launch', description: 'All content for the Q3 product launch campaign', owner_id: userId, start_date: d(-14), end_date: d(30), status: 'active' },
    { workspace_id: workspaceId, title: 'Brand Refresh', description: 'Refreshing visual identity and messaging across channels', owner_id: userId, start_date: d(-7), end_date: d(60), status: 'active' },
  ]).select('id');
  if (projErr) { logs.push(`ERROR projects: ${projErr.message}`); return logs; }
  logs.push(`Created ${projects?.length ?? 0} projects`);

  const [proj1Id, proj2Id] = (projects ?? []).map(p => p.id);

  // Insert 12 content items
  const items = [
    { title: 'Q3 Launch Announcement Blog Post', content_type_id: ctId('blog'), status: colId('backlog'), priority: 'urgent' as const, channel: 'Blog', due_date: d(-3), project_id: proj1Id, tags: ['launch', 'product'], description: 'Main announcement post for Q3 product launch. Should cover new features, pricing changes, and customer impact.' },
    { title: 'Product Hunt Launch Day Posts', content_type_id: ctId('social'), status: colId('review'), priority: 'high' as const, channel: 'Twitter/X', due_date: d(2), project_id: proj1Id, tags: ['product-hunt', 'launch'], description: 'Series of posts for Product Hunt launch day. Needs hunter outreach beforehand.' },
    { title: 'Email Campaign: New Features', content_type_id: ctId('email'), status: colId('approved'), priority: 'high' as const, channel: 'Email', due_date: d(5), project_id: proj1Id, tags: ['email', 'features'], description: 'Announce new features to existing customers via email. Segment by plan type.' },
    { title: 'LinkedIn Thought Leadership: AI in Content', content_type_id: ctId('social'), status: colId('progress') ?? colId('in'), priority: 'medium' as const, channel: 'LinkedIn', due_date: d(7), project_id: proj2Id, tags: ['ai', 'thought-leadership'], description: 'Long-form post on how AI is reshaping content operations.' },
    { title: 'Customer Story: Acme Corp', content_type_id: ctId('customer') ?? ctId('blog'), status: colId('progress') ?? colId('in'), priority: 'high' as const, channel: 'Blog', due_date: d(10), project_id: proj1Id, tags: ['case-study', 'customer'], description: 'In-depth case study of how Acme Corp uses the platform. Interview scheduled for Thursday.' },
    { title: 'Q3 Product Webinar Registration Page', content_type_id: ctId('landing') ?? ctId('web'), status: colId('scheduled'), priority: 'urgent' as const, channel: 'Website', due_date: d(-1), project_id: proj1Id, publish_date: d(3), tags: ['webinar', 'landing-page'], description: 'Landing page for Q3 webinar series. Form should integrate with HubSpot.' },
    { title: 'Instagram Brand Story Series', content_type_id: ctId('social'), status: colId('backlog'), priority: 'low' as const, channel: 'Instagram', due_date: d(14), project_id: proj2Id, tags: ['instagram', 'brand'], description: 'Multi-part story series showcasing brand values and team culture.' },
    { title: 'SEO Blog: Best Practices for Content Calendar', content_type_id: ctId('blog'), status: colId('published'), priority: 'medium' as const, channel: 'Blog', due_date: d(-10), publish_date: d(-8), tags: ['seo', 'content-strategy'], description: 'Evergreen SEO content targeting content calendar keywords.' },
    { title: 'Press Release: Series B Funding', content_type_id: ctId('press') ?? ctId('blog'), status: colId('approved'), priority: 'urgent' as const, channel: 'Website', due_date: d(1), project_id: proj1Id, tags: ['press', 'funding'], description: 'Series B announcement press release. Embargo until announcement day.' },
    { title: 'YouTube Tutorial: Getting Started', content_type_id: ctId('video') ?? ctId('blog'), status: colId('review'), priority: 'medium' as const, channel: 'YouTube', due_date: d(20), project_id: proj2Id, tags: ['tutorial', 'onboarding'], description: 'Beginner tutorial video covering core features. Script needs review.' },
    { title: 'Ad Creative: Q3 Paid Campaign', content_type_id: ctId('ad') ?? ctId('social'), status: colId('backlog'), priority: 'high' as const, channel: 'Facebook', due_date: d(8), project_id: proj1Id, tags: ['ads', 'paid'], description: 'Set of 5 ad creatives for Facebook/Instagram paid campaign.' },
    { title: 'One-Pager: Feature Comparison', content_type_id: ctId('one-pager') ?? ctId('blog'), status: colId('published'), priority: 'low' as const, channel: 'Website', due_date: d(-20), publish_date: d(-18), project_id: proj2Id, tags: ['sales-enablement', 'comparison'], description: 'Competitive comparison sheet for sales team.' },
  ];

  const { data: insertedItems, error: itemErr } = await supabase.from('content_items').insert(
    items.map(item => ({ ...item, workspace_id: workspaceId, created_by: userId }))
  ).select('id, title');
  if (itemErr) { logs.push(`ERROR content_items: ${itemErr.message}`); return logs; }
  logs.push(`Created ${insertedItems?.length ?? 0} content items`);

  if (!insertedItems || insertedItems.length === 0) return logs;

  // Add subtasks to first 3 items
  const subtaskInserts = [
    { content_item_id: insertedItems[0].id, title: 'Write first draft', position: 0 },
    { content_item_id: insertedItems[0].id, title: 'Internal review', position: 1, completed: true },
    { content_item_id: insertedItems[0].id, title: 'SEO optimization', position: 2 },
    { content_item_id: insertedItems[1].id, title: 'Draft tweet thread', position: 0 },
    { content_item_id: insertedItems[1].id, title: 'Get design assets', position: 1 },
    { content_item_id: insertedItems[2].id, title: 'Write subject lines (A/B)', position: 0, completed: true },
    { content_item_id: insertedItems[2].id, title: 'Segment audience lists', position: 1 },
    { content_item_id: insertedItems[2].id, title: 'Set up in email tool', position: 2 },
  ];
  const { error: stErr } = await supabase.from('subtasks').insert(subtaskInserts);
  if (stErr) logs.push(`WARN subtasks: ${stErr.message}`);
  else logs.push(`Created ${subtaskInserts.length} subtasks`);

  // Add comments to first 2 items
  const commentInserts = [
    { content_item_id: insertedItems[0].id, user_id: userId, body: 'First draft is looking good! Let\'s make sure we include the pricing table.' },
    { content_item_id: insertedItems[0].id, user_id: userId, body: 'Approved for publishing after SEO review is done.' },
    { content_item_id: insertedItems[1].id, user_id: userId, body: 'Design team confirmed assets will be ready by Tuesday.' },
  ];
  const { error: cmtErr } = await supabase.from('comments').insert(commentInserts);
  if (cmtErr) logs.push(`WARN comments: ${cmtErr.message}`);
  else logs.push(`Created ${commentInserts.length} comments`);

  // Add activity log entries
  const activityInserts = insertedItems.slice(0, 5).map(item => ({
    content_item_id: item.id,
    user_id: userId,
    action: 'Created content item',
    metadata: { title: item.title, source: 'seed' },
  }));
  const { error: actErr } = await supabase.from('activity_log').insert(activityInserts);
  if (actErr) logs.push(`WARN activity: ${actErr.message}`);
  else logs.push(`Created ${activityInserts.length} activity entries`);

  // Add external links for first 3 items
  const linkInserts = [
    { content_item_id: insertedItems[0].id, platform: 'figma', url: 'https://figma.com/design/example', title: 'Blog Post Mockup', thumbnail_url: '', metadata: { description: 'Design mockup for blog header' }, created_by: userId },
    { content_item_id: insertedItems[0].id, platform: 'google_docs', url: 'https://docs.google.com/document/d/example', title: 'Content Brief', thumbnail_url: '', metadata: { description: 'Full content brief and outline' }, created_by: userId },
    { content_item_id: insertedItems[1].id, platform: 'canva', url: 'https://canva.com/design/example', title: 'Social Graphics', thumbnail_url: '', metadata: { description: 'Canva design for social posts' }, created_by: userId },
    { content_item_id: insertedItems[2].id, platform: 'notion', url: 'https://notion.so/example', title: 'Email Campaign Notes', thumbnail_url: '', metadata: { description: 'Campaign planning notes' }, created_by: userId },
  ];
  const { error: linkErr } = await supabase.from('external_links').insert(linkInserts);
  if (linkErr) logs.push(`WARN external_links: ${linkErr.message}`);
  else logs.push(`Created ${linkInserts.length} external links`);

  logs.push('Seed complete');
  return logs;
}

// ── Main debug page ────────────────────────────────────────────────────────────

export function DebugPage() {
  const { workspace, user, userRole, contentTypes, boardColumns, contentItems, projects } = useApp();
  const [dbChecks, setDbChecks] = useState<CheckResult[]>([]);
  const [authChecks, setAuthChecks] = useState<CheckResult[]>([]);
  const [integrationChecks, setIntegrationChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedLogs, setSeedLogs] = useState<string[]>([]);
  const [crudLog, setCrudLog] = useState<string[]>([]);

  // ── DB checks ──────────────────────────────────────────────────────────────

  const runDbChecks = useCallback(async () => {
    if (!workspace) return;

    const tables = [
      'workspaces', 'workspace_members', 'content_types', 'board_columns',
      'projects', 'content_items', 'subtasks', 'comments', 'activity_log',
      'custom_field_definitions', 'intake_forms', 'intake_form_fields',
      'intake_submissions', 'workspace_invites', 'external_links',
      'integrations', 'ai_interactions',
    ];

    const results: CheckResult[] = [];

    // Table row counts
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table as 'workspaces')
          .select('*', { count: 'exact', head: true });

        if (error) {
          results.push({ label: table, status: 'fail', detail: error.message, extra: 'ERROR' });
        } else {
          const wsScoped = ['content_types', 'board_columns', 'projects', 'content_items', 'workspace_members', 'integrations'].includes(table);
          results.push({ label: table, status: 'pass', extra: `${count ?? 0} rows` });
        }
      } catch (e) {
        results.push({ label: table, status: 'fail', detail: String(e), extra: 'EXCEPTION' });
      }
    }

    // CRUD cycle test
    const crudLogs: string[] = [];
    let tempId: string | null = null;

    try {
      // INSERT
      const { data: ins, error: insErr } = await supabase
        .from('content_items')
        .insert({ workspace_id: workspace.id, title: '__debug_test_item__', created_by: user?.id ?? null })
        .select('id')
        .maybeSingle();
      if (insErr) throw new Error(`INSERT failed: ${insErr.message}`);
      tempId = ins?.id ?? null;
      crudLogs.push('✓ INSERT');

      // READ
      const { data: readData, error: readErr } = await supabase
        .from('content_items').select('id, title').eq('id', tempId!).maybeSingle();
      if (readErr || !readData) throw new Error(`READ failed: ${readErr?.message ?? 'no data'}`);
      crudLogs.push('✓ READ');

      // UPDATE
      const { error: updErr } = await supabase
        .from('content_items').update({ title: '__debug_updated__' }).eq('id', tempId!);
      if (updErr) throw new Error(`UPDATE failed: ${updErr.message}`);
      crudLogs.push('✓ UPDATE');

      // DELETE
      const { error: delErr } = await supabase
        .from('content_items').delete().eq('id', tempId!);
      if (delErr) throw new Error(`DELETE failed: ${delErr.message}`);
      crudLogs.push('✓ DELETE');

      results.push({ label: 'CRUD cycle (insert→read→update→delete)', status: 'pass', detail: crudLogs.join('\n') });
    } catch (e) {
      if (tempId) {
        await supabase.from('content_items').delete().eq('id', tempId).eq('title', '__debug_updated__');
      }
      crudLogs.push(`✗ ${String(e)}`);
      results.push({ label: 'CRUD cycle', status: 'fail', detail: crudLogs.join('\n') });
    }
    setCrudLog(crudLogs);
    setDbChecks(results);
  }, [workspace, user]);

  // ── Auth checks ────────────────────────────────────────────────────────────

  const runAuthChecks = useCallback(async () => {
    if (!user || !workspace) return;
    const results: CheckResult[] = [];

    // Session info
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const expiry = new Date(session.expires_at! * 1000);
      const minutesLeft = Math.round((expiry.getTime() - Date.now()) / 60000);
      results.push({
        label: 'Session active',
        status: minutesLeft > 5 ? 'pass' : 'warn',
        detail: `User: ${session.user.email}\nID: ${session.user.id}\nProvider: ${session.user.app_metadata.provider}\nExpires: ${expiry.toLocaleString()} (${minutesLeft}m)`,
        extra: `${minutesLeft}m left`,
      });
    } else {
      results.push({ label: 'Session', status: 'fail', detail: 'No active session' });
    }

    // Role check
    results.push({
      label: `Role: ${userRole ?? 'unknown'}`,
      status: userRole ? 'pass' : 'fail',
      extra: userRole ?? 'none',
    });

    // Workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role, joined_at')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .maybeSingle();
    results.push({
      label: 'Workspace membership',
      status: membership ? 'pass' : 'fail',
      detail: membership ? `Role: ${membership.role}\nJoined: ${new Date(membership.joined_at).toLocaleString()}` : 'Not a member',
    });

    // RLS test — can we read workspace-scoped items only?
    const { data: scopedItems, error: scopeErr } = await supabase
      .from('content_items')
      .select('id, workspace_id')
      .limit(20);
    const allScoped = (scopedItems ?? []).every(i => i.workspace_id === workspace.id);
    results.push({
      label: 'RLS: content_items scoped to workspace',
      status: scopeErr ? 'fail' : allScoped ? 'pass' : 'fail',
      detail: scopeErr?.message ?? `${scopedItems?.length ?? 0} items checked, all in workspace: ${allScoped}`,
      extra: `${scopedItems?.length ?? 0} rows`,
    });

    // All workspace members
    const { data: allMembers } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspace.id);
    results.push({
      label: `Workspace members (${allMembers?.length ?? 0})`,
      status: 'pass',
      detail: (allMembers ?? []).map(m => `${m.user_id.slice(0, 8)}... — ${m.role}`).join('\n'),
      extra: `${allMembers?.length ?? 0} members`,
    });

    // Activity log
    const { data: actLog } = await supabase
      .from('activity_log')
      .select('action, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    results.push({
      label: `Activity log (last 10)`,
      status: 'pass',
      detail: (actLog ?? []).map(a => `${new Date(a.created_at).toLocaleTimeString()} — ${a.action}`).join('\n') || 'No activity yet',
      extra: `${actLog?.length ?? 0} entries`,
    });

    setAuthChecks(results);
  }, [user, workspace, userRole]);

  // ── Integration checks ─────────────────────────────────────────────────────

  const runIntegrationChecks = useCallback(async () => {
    if (!workspace) return;
    const results: CheckResult[] = [];

    const { data: ints } = await supabase
      .from('integrations')
      .select('platform, status, connected_at, updated_at, config')
      .eq('workspace_id', workspace.id);

    const platforms = ['google', 'notion', 'linear', 'claude'];
    for (const platform of platforms) {
      const int = (ints ?? []).find(i => i.platform === platform);
      if (!int) {
        results.push({ label: `${platform}: not connected`, status: 'warn', extra: 'not set up' });
      } else {
        const cfg = int.config as Record<string, string>;
        const hasKey = Object.values(cfg).some(v => v && v.length > 4);
        results.push({
          label: `${platform}: ${int.status}`,
          status: int.status === 'connected' ? (hasKey ? 'pass' : 'warn') : 'fail',
          detail: `Status: ${int.status}\nConnected: ${new Date(int.connected_at).toLocaleString()}\nHas credentials: ${hasKey}`,
          extra: int.status,
        });
      }
    }

    setIntegrationChecks(results);
  }, [workspace]);

  // ── Run all checks ─────────────────────────────────────────────────────────

  const runAll = useCallback(async () => {
    setRunning(true);
    setDbChecks(prev => prev.map(c => ({ ...c, status: 'loading' as Status })));
    setAuthChecks(prev => prev.map(c => ({ ...c, status: 'loading' as Status })));
    await Promise.all([runDbChecks(), runAuthChecks(), runIntegrationChecks()]);
    setRunning(false);
  }, [runDbChecks, runAuthChecks, runIntegrationChecks]);

  useEffect(() => {
    if (workspace && user) runAll();
  }, [workspace, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seed ──────────────────────────────────────────────────────────────────

  async function handleSeed() {
    if (!workspace || !user) return;
    if (!confirm('This will add 12 content items, 2 projects, subtasks, comments, and external links. Continue?')) return;
    setSeeding(true);
    setSeedLogs(['Starting seed...']);
    const logs = await seedTestData(workspace.id, user.id, contentTypes, boardColumns);
    setSeedLogs(logs);
    setSeeding(false);
    await runAll();
  }

  // ── window.__debugCalendar ─────────────────────────────────────────────────

  useEffect(() => {
    (window as Window & { __debugCalendar?: () => void }).__debugCalendar = async () => {
      console.group('🗓️ ContentCal Debug');

      const { data: { session } } = await supabase.auth.getSession();
      console.log('Auth:', session ? `${session.user.email} (${session.user.id})` : 'NOT SIGNED IN');
      console.log('Workspace:', workspace?.name, workspace?.id);
      console.log('Role:', userRole);

      console.group('Entity counts');
      console.log('Content items:', contentItems.length);
      console.log('Projects:', projects.length);
      console.log('Content types:', contentTypes.length);
      console.log('Board columns:', boardColumns.length);

      const { count: subtaskCount } = await supabase.from('subtasks').select('*', { count: 'exact', head: true });
      const { count: commentCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
      console.log('Subtasks:', subtaskCount);
      console.log('Comments:', commentCount);
      console.groupEnd();

      // Broken references
      console.group('Integrity checks');
      const ctIds = new Set(contentTypes.map(c => c.id));
      const colIds = new Set(boardColumns.map(c => c.id));
      const projIds = new Set(projects.map(p => p.id));

      const brokenType = contentItems.filter(i => i.content_type_id && !ctIds.has(i.content_type_id));
      const brokenStatus = contentItems.filter(i => i.status && !colIds.has(i.status));
      const brokenProject = contentItems.filter(i => i.project_id && !projIds.has(i.project_id));

      console.log('Items with unknown content_type_id:', brokenType.length, brokenType.map(i => i.title));
      console.log('Items with unknown status:', brokenStatus.length, brokenStatus.map(i => i.title));
      console.log('Items with unknown project_id:', brokenProject.length, brokenProject.map(i => i.title));
      console.groupEnd();

      // Integrations
      const { data: ints } = await supabase.from('integrations').select('platform, status').eq('workspace_id', workspace?.id ?? '');
      console.group('Integrations');
      for (const int of ints ?? []) console.log(int.platform, '→', int.status);
      if (!ints?.length) console.log('No integrations configured');
      console.groupEnd();

      console.groupEnd();
    };
    console.log('%c window.__debugCalendar() available', 'color: #3B82F6; font-weight: bold;');
  }, [workspace, user, userRole, contentItems, projects, contentTypes, boardColumns]);

  // ── Entity summary ────────────────────────────────────────────────────────

  const summary = [
    { label: 'Content items', count: contentItems.length, warn: contentItems.length === 0 },
    { label: 'Projects', count: projects.length, warn: false },
    { label: 'Content types', count: contentTypes.length, warn: contentTypes.length === 0 },
    { label: 'Board columns', count: boardColumns.length, warn: boardColumns.length === 0 },
  ];

  // Broken references
  const ctIds = new Set(contentTypes.map(c => c.id));
  const colIds = new Set(boardColumns.map(c => c.id));
  const projIds = new Set(projects.map(p => p.id));
  const brokenItems = contentItems.filter(i =>
    (i.content_type_id && !ctIds.has(i.content_type_id)) ||
    (i.status && !colIds.has(i.status)) ||
    (i.project_id && !projIds.has(i.project_id))
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">System Health Dashboard</h1>
              <p className="text-xs text-gray-500">Workspace: {workspace?.name} · User: {user?.email}</p>
            </div>
          </div>
          <button
            onClick={runAll}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-60 transition-colors"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Re-run all checks
          </button>
        </div>

        {/* Entity summary */}
        <div className="grid grid-cols-4 gap-3">
          {summary.map(s => (
            <div key={s.label} className={`bg-white border rounded-xl p-4 ${s.warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}`}>
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              {s.warn && <p className="text-xs text-amber-600 mt-1 font-medium">⚠ Empty</p>}
            </div>
          ))}
        </div>

        {brokenItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Broken references detected</p>
              <p className="text-xs text-red-700 mt-0.5">{brokenItems.length} item(s) reference unknown content_type_id, status, or project_id</p>
              <ul className="mt-1 space-y-0.5">
                {brokenItems.slice(0, 5).map(i => (
                  <li key={i.id} className="text-xs text-red-600 font-mono">{i.title}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Checks */}
        <Section title="Database" icon={Database} checks={dbChecks} running={running} />
        <Section title="Auth & Permissions" icon={Shield} checks={authChecks} running={running} />
        <Section title="Integrations" icon={Plug} checks={integrationChecks} running={running} />

        {/* Seed data */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">Seed test data</h3>
            </div>
            <button
              onClick={handleSeed}
              disabled={seeding || contentItems.length >= 5}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {contentItems.length >= 5 ? `${contentItems.length} items exist` : 'Seed now'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {contentItems.length >= 5
              ? `Database already has ${contentItems.length} content items. Seed only runs when fewer than 5 items exist.`
              : 'Creates 12 content items, 2 projects, subtasks, comments, activity entries, and external links.'}
          </p>
          {seedLogs.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-0.5">
              {seedLogs.map((log, i) => (
                <p key={i} className={log.startsWith('ERROR') ? 'text-red-400' : log.startsWith('WARN') ? 'text-amber-400' : log.startsWith('✓') ? 'text-green-400' : 'text-gray-300'}>
                  {log}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Console function info */}
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-green-400 font-mono">Console utilities</span>
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Run <span className="text-green-300">window.__debugCalendar()</span> in the browser console for a full system report including entity counts, RLS validation, and integration status.
          </p>
        </div>
      </div>
    </div>
  );
}
