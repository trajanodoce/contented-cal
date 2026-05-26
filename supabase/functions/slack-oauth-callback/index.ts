import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") ?? "";
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://contentedcal.com";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/slack-oauth-callback`;

function decodeState(state: string): { workspace_id: string; user_id: string; ts: number } | null {
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const parsed = JSON.parse(json);
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    if (!parsed.workspace_id || !parsed.user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(`${APP_URL}/settings?tab=integrations&slack=denied`, 302);
  }

  if (!code || !stateParam) {
    return Response.redirect(`${APP_URL}/settings?tab=integrations&slack=error`, 302);
  }

  const state = decodeState(stateParam);
  if (!state) {
    return Response.redirect(`${APP_URL}/settings?tab=integrations&slack=error&reason=invalid_state`, 302);
  }

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
    return Response.redirect(`${APP_URL}/settings?tab=integrations&slack=error&reason=token_exchange`, 302);
  }

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
    return Response.redirect(`${APP_URL}/settings?tab=integrations&slack=error&reason=db_error`, 302);
  }

  return Response.redirect(`${APP_URL}/settings?tab=integrations&slack=connected`, 302);
});
