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

  // Reject requests older than 5 minutes (replay protection)
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip the <@UBOT> mention prefix from the message text. */
function stripMention(text: string, botUserId: string): string {
  return text
    .replace(new RegExp(`<@${botUserId}>\\s*`, "gi"), "")
    .replace(/^<@[A-Z0-9]+>\s*/i, "")
    .trim();
}

/** Extract title (first line, max 120 chars) and full description. */
function parseContent(text: string): { title: string; description: string } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "Slack request";
  const title =
    firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine;
  return { title, description: text };
}

/** Look up the Slack user's real name via users.info. */
async function getSlackUserName(
  botToken: string,
  userId: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
    const data = await res.json();
    return data.ok
      ? data.user?.real_name || data.user?.name || null
      : null;
  } catch {
    return null;
  }
}

/** Post a message to Slack. */
async function postSlackMessage(
  botToken: string,
  channel: string,
  threadTs: string,
  text: string
) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, thread_ts: threadTs, text }),
  });
  const data = await res.json();
  if (!data.ok) console.error("Slack postMessage error:", data.error);
  return data;
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  const payload = JSON.parse(body);

  // ── URL verification challenge ─────────────────────────────────────────

  if (payload.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify signature for all non-challenge requests
  const valid = await verifySlackSignature(body, timestamp, signature);
  if (!valid) {
    console.error("Invalid Slack signature");
    return new Response("Invalid signature", { status: 401 });
  }

  // ── Event callback ─────────────────────────────────────────────────────

  if (payload.type === "event_callback") {
    const event = payload.event;

    if (event?.type !== "app_mention") {
      return new Response("OK", { status: 200 });
    }

    // Ignore bot messages to prevent loops
    if (event.bot_id) {
      return new Response("OK", { status: 200 });
    }

    const teamId: string = payload.team_id;
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
      console.error(
        "No workspace found for Slack team:",
        teamId,
        lookupError
      );
      return new Response("OK", { status: 200 });
    }

    const config = integration.config as Record<string, string>;
    const botUserId = config?.bot_user_id ?? "";
    const botToken = integration.access_token;

    // Parse the message
    const cleanText = stripMention(event.text ?? "", botUserId);
    const { title, description } = parseContent(cleanText);

    // Resolve the Slack user's name
    const slackUserName = await getSlackUserName(botToken, event.user);

    // Get the default (first) board column for new items
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
          _slack_channel: event.channel,
          _slack_ts: event.ts,
          _slack_user: event.user,
          _slack_user_name: slackUserName,
          _slack_team_id: teamId,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create content item:", insertError);
      await postSlackMessage(
        botToken,
        event.channel,
        event.ts,
        "Sorry, I couldn't create that item. Please try again or create it directly in ContentedCal."
      );
      return new Response("OK", { status: 200 });
    }

    // Reply in the thread
    const itemUrl = `${APP_URL}/list?item=${newItem.id}`;
    const fromLine = slackUserName ? ` from ${slackUserName}` : "";
    await postSlackMessage(
      botToken,
      event.channel,
      event.ts,
      `Got it! Created *${title}*${fromLine}.\n<${itemUrl}|View in ContentedCal>`
    );

    return new Response("OK", { status: 200 });
  }

  return new Response("OK", { status: 200 });
});
