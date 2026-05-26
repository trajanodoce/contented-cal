import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Env ──────────────────────────────────────────────────────────────────────

const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://contentedcal.com";

// ── Signature verification ───────────────────────────────────────────────────

async function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(sigBasestring)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signature === `v0=${hex}`;
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  const valid = await verifySlackSignature(body, timestamp, signature);
  if (!valid) {
    console.error("Invalid Slack signature");
    return new Response("Invalid signature", { status: 401 });
  }

  // Slack slash commands arrive as application/x-www-form-urlencoded
  const params = new URLSearchParams(body);
  const text = params.get("text")?.trim() ?? "";
  const userId = params.get("user_id") ?? "";
  const teamId = params.get("team_id") ?? "";
  const channelId = params.get("channel_id") ?? "";
  const responseUrl = params.get("response_url") ?? "";

  // ── Validate input ─────────────────────────────────────────────────────

  if (!text) {
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: "Please provide a title for the content request.\nUsage: `/content-request Blog post about our new feature`",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the connected workspace
  const { data: integration, error: lookupError } = await supabase
    .from("integrations")
    .select("*")
    .eq("platform", "slack")
    .eq("status", "connected")
    .filter("config->>slack_team_id", "eq", teamId)
    .single();

  if (lookupError || !integration) {
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: "ContentedCal isn't connected to this Slack workspace yet. Ask a workspace admin to set it up in Settings → Integrations.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const botToken = integration.access_token;

  // Resolve user name
  let userName: string | null = null;
  try {
    const res = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
    const data = await res.json();
    if (data.ok) {
      userName = data.user?.real_name || data.user?.name || null;
    }
  } catch {
    // non-critical
  }

  // Parse title and description
  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "Slack request";
  const title =
    firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine;
  const description = text;

  // Get default board column
  const { data: columns } = await supabase
    .from("board_columns")
    .select("id")
    .eq("workspace_id", integration.workspace_id)
    .order("position", { ascending: true })
    .limit(1);

  const defaultStatus = columns?.[0]?.id ?? null;

  // Create the content item
  const { data: newItem, error: insertError } = await supabase
    .from("content_items")
    .insert({
      workspace_id: integration.workspace_id,
      title,
      description,
      status: defaultStatus,
      tags: ["slack-request"],
      custom_fields: {
        _source: "slack",
        _slack_channel: channelId,
        _slack_user: userId,
        _slack_user_name: userName,
        _slack_team_id: teamId,
        _slack_via: "slash_command",
      },
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create content item:", insertError);
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: "Sorry, I couldn't create that item. Please try again.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const itemUrl = `${APP_URL}/list?item=${newItem.id}`;

  // Respond with in_channel confirmation so the team can see it
  // Use the response_url for a follow-up visible message
  if (responseUrl) {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "in_channel",
        text: `📋 *Content request added* by ${userName ?? "someone"}:\n*${title}*\n<${itemUrl}|View in ContentedCal>`,
      }),
    });
  }

  // Immediate ephemeral ack
  return new Response(
    JSON.stringify({
      response_type: "ephemeral",
      text: `Content request created: *${title}*\n<${itemUrl}|View in ContentedCal>`,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
