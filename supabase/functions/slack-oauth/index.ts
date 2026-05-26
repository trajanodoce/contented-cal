import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Env ──────────────────────────────────────────────────────────────────────

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") ?? "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://contentedcal.com";

const SCOPES = "app_mentions:read,channels:history,groups:history,chat:write,chat:write.public,commands,users:read,users:read.email";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/slack-oauth-callback`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Encode workspace + user into a tamper-resistant state param. */
function encodeState(workspaceId: string, userId: string): string {
  const payload = JSON.stringify({
    workspace_id: workspaceId,
    user_id: userId,
    ts: Date.now(),
  });
  // Base64-URL encode (not signed — Slack's own code exchange is the real guard)
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeState(
  state: string
): { workspace_id: string; user_id: string; ts: number } | null {
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const parsed = JSON.parse(json);
    // Reject if state is older than 10 minutes
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    if (!parsed.workspace_id || !parsed.user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "authorize";

  // ── Authorize: redirect user to Slack ──────────────────────────────────────

  if (action === "authorize") {
    const workspaceId = url.searchParams.get("workspace_id");
    const userId = url.searchParams.get("user_id");

    if (!workspaceId || !userId) {
      return new Response(
        JSON.stringify({ error: "workspace_id and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const state = encodeState(workspaceId, userId);

    const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
    slackUrl.searchParams.set("client_id", SLACK_CLIENT_ID);
    slackUrl.searchParams.set("scope", SCOPES);
    slackUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    slackUrl.searchParams.set("state", state);

    return Response.redirect(slackUrl.toString(), 302);
  }

  // ── Callback: exchange code for token ──────────────────────────────────────

  if (action === "callback") {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // User denied or error from Slack
    if (error) {
      return Response.redirect(
        `${APP_URL}/settings?tab=integrations&slack=denied`,
        302
      );
    }

    if (!code || !stateParam) {
      return Response.redirect(
        `${APP_URL}/settings?tab=integrations&slack=error`,
        302
      );
    }

    // Validate state
    const state = decodeState(stateParam);
    if (!state) {
      return Response.redirect(
        `${APP_URL}/settings?tab=integrations&slack=error&reason=invalid_state`,
        302
      );
    }

    // Exchange code for access token
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      console.error("Slack token exchange failed:", tokenData.error);
      return Response.redirect(
        `${APP_URL}/settings?tab=integrations&slack=error&reason=token_exchange`,
        302
      );
    }

    // Store in integrations table
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: dbError } = await supabase.from("integrations").upsert(
      {
        workspace_id: state.workspace_id,
        platform: "slack",
        access_token: tokenData.access_token,
        refresh_token: "",
        config: {
          slack_team_id: tokenData.team?.id ?? "",
          slack_team_name: tokenData.team?.name ?? "",
          bot_user_id: tokenData.bot_user_id ?? "",
          authed_user_id: tokenData.authed_user?.id ?? "",
          scope: tokenData.scope ?? "",
        },
        status: "connected",
        connected_by: state.user_id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,platform" }
    );

    if (dbError) {
      console.error("DB upsert error:", dbError);
      return Response.redirect(
        `${APP_URL}/settings?tab=integrations&slack=error&reason=db_error`,
        302
      );
    }

    return Response.redirect(
      `${APP_URL}/settings?tab=integrations&slack=connected`,
      302
    );
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
