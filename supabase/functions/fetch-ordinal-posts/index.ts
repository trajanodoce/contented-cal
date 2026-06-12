import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Live-pull of the Ordinal social calendar into ContentedCal (view-only).
// Reads the workspace's stored Ordinal API key, fetches posts from Ordinal's
// REST API, and upserts them via the existing upsert_ordinal_post RPC (same
// path the old external push used). Throttled via check_and_mark_sync_due so
// the calendar can call it on load without hammering the API; pass
// { force: true } to bypass the throttle (the "Sync now" button).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// The single app-wide calendar workspace that mirrors Ordinal (view-only).
const CALENDAR_WORKSPACE_ID = "0dd83def-67f8-4b8a-b86d-91c624520630";
const ORDINAL_API = "https://app.tryordinal.com/api/v1";
// How far back to pull. Posts scheduled within this window + all future ones.
const LOOKBACK_DAYS = 75;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

interface OrdinalPost {
  id: string;
  url: string;
  title: string;
  channels: string[];
  status: string;
  publishAt: string | null;
  publishDate: string | null;
  labels: { name: string }[];
  linkedIn?: { profile?: { name?: string; detail?: string }; copy?: string } | null;
  x?: { profile?: { name?: string; detail?: string }; tweets?: { copy?: string }[] } | null;
  instagram?: { profile?: { name?: string; detail?: string }; copy?: string } | null;
  tikTok?: { profile?: { name?: string; detail?: string }; copy?: string } | null;
}

// Mirror of the receiver's extractPostDetails — pick body/profile from the
// primary channel and normalize Twitter -> X.
function extractPostDetails(post: OrdinalPost) {
  const primary = post.channels?.[0] || "Unknown";
  let body: string | null = null;
  let profileName: string | null = null;
  let profileHandle: string | null = null;

  if (primary === "LinkedIn" && post.linkedIn) {
    body = post.linkedIn.copy ?? null;
    profileName = post.linkedIn.profile?.name ?? null;
    profileHandle = post.linkedIn.profile?.detail ?? null;
  } else if ((primary === "Twitter" || primary === "X") && post.x) {
    body = post.x.tweets?.[0]?.copy ?? null;
    profileName = post.x.profile?.name ?? null;
    profileHandle = post.x.profile?.detail ?? null;
  } else if (primary === "Instagram" && post.instagram) {
    body = post.instagram.copy ?? null;
    profileName = post.instagram.profile?.name ?? null;
    profileHandle = post.instagram.profile?.detail ?? null;
  } else if (primary === "TikTok" && post.tikTok) {
    body = post.tikTok.copy ?? null;
    profileName = post.tikTok.profile?.name ?? null;
    profileHandle = post.tikTok.profile?.detail ?? null;
  }

  const channel = primary === "Twitter" ? "X" : primary;
  return { channel, body, profileName, profileHandle };
}

async function fetchOrdinalPosts(apiKey: string): Promise<OrdinalPost[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000)
    .toISOString().slice(0, 19) + "Z";
  const all: OrdinalPost[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      limit: "100",
      sortBy: "publishAt",
      sortOrder: "desc",
      publishDateMin: since,
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${ORDINAL_API}/posts?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ordinal API ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const posts: OrdinalPost[] = json.posts ?? [];
    all.push(...posts);
    if (!json.hasMore || !json.nextCursor) break;
    cursor = json.nextCursor;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Auth: any authenticated member of the calendar workspace may trigger a
    // refresh (Ordinal data is shared + view-only).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: CORS });
    }
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Membership check on the calendar workspace.
    const { data: member } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", CALENDAR_WORKSPACE_ID)
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    // Throttle (every sync_interval_minutes) unless forced.
    if (!force) {
      const { data: due } = await supabase.rpc("check_and_mark_sync_due", {
        p_platform: "ordinal",
        p_workspace_id: CALENDAR_WORKSPACE_ID,
      });
      if (due !== true) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "not due yet" }), { headers: CORS });
      }
    }

    // Read the workspace's stored Ordinal API key.
    const { data: integration } = await supabase
      .from("integrations")
      .select("config")
      .eq("workspace_id", CALENDAR_WORKSPACE_ID)
      .eq("platform", "ordinal")
      .maybeSingle();
    const apiKey = (integration?.config as Record<string, unknown> | null)?.api_key as string | undefined;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Ordinal API key not configured" }), { status: 400, headers: CORS });
    }

    const posts = await fetchOrdinalPosts(apiKey);

    let synced = 0, created = 0;
    const errors: string[] = [];
    for (const post of posts) {
      const d = extractPostDetails(post);
      const labels = (post.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
      const { data, error } = await supabase.rpc("upsert_ordinal_post", {
        p_workspace_id: CALENDAR_WORKSPACE_ID,
        p_ordinal_post_id: post.id,
        p_title: post.title,
        p_channel: d.channel,
        p_status: post.status,
        p_post_body: d.body,
        p_post_url: post.url,
        p_publish_at: post.publishAt ?? (post.publishDate ? `${post.publishDate}T12:00:00Z` : null),
        p_profile_name: d.profileName,
        p_profile_handle: d.profileHandle,
        p_labels: labels,
      });
      if (!error && data) {
        synced++;
        if ((data as { is_new?: boolean }).is_new) created++;
      } else if (error) {
        errors.push(`${post.id}: ${error.message}`);
      }
    }

    const result = {
      synced,
      created,
      updated: synced - created,
      fetched: posts.length,
      errors: errors.length,
      error_details: errors.length ? errors.slice(0, 5) : undefined,
      synced_at: new Date().toISOString(),
    };
    await supabase.rpc("record_sync_result", {
      p_platform: "ordinal",
      p_workspace_id: CALENDAR_WORKSPACE_ID,
      p_result: result,
    });

    return new Response(JSON.stringify({ success: true, ...result }), { headers: CORS });
  } catch (err) {
    console.error("fetch-ordinal-posts error:", err);
    return new Response(JSON.stringify({ error: "Internal error during Ordinal sync" }), { status: 500, headers: CORS });
  }
});
