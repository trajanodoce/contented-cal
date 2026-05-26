import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(sigBasestring));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === `v0=${hex}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripMention(text: string, botUserId: string): string {
  return text
    .replace(new RegExp(`<@${botUserId}>\\s*`, "gi"), "")
    .replace(/^<@[A-Z0-9]+>\s*/i, "")
    .trim();
}

async function getSlackUserName(
  botToken: string,
  userId: string
): Promise<string | null> {
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json();
    return data.ok ? data.user?.real_name || data.user?.name || null : null;
  } catch {
    return null;
  }
}

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

/** Fetch full thread replies from Slack. */
async function getThreadReplies(
  botToken: string,
  channel: string,
  threadTs: string
): Promise<{ user: string; text: string }[]> {
  try {
    const res = await fetch(
      `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}&limit=50`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
    const data = await res.json();
    if (!data.ok || !data.messages) return [];
    return data.messages.map((m: { user?: string; text?: string }) => ({
      user: m.user ?? "",
      text: m.text ?? "",
    }));
  } catch {
    return [];
  }
}

/** Build a readable thread summary for the content item description. */
async function buildThreadDescription(
  botToken: string,
  channel: string,
  threadTs: string,
  botUserId: string
): Promise<string> {
  const messages = await getThreadReplies(botToken, channel, threadTs);
  if (messages.length === 0) return "";

  // Resolve user names for all unique users
  const userIds = [...new Set(messages.map((m) => m.user).filter(Boolean))];
  const userNames: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (uid) => {
      const name = await getSlackUserName(botToken, uid);
      if (name) userNames[uid] = name;
    })
  );

  // Format thread as readable conversation, skip bot messages
  const lines = messages
    .filter((m) => m.user !== botUserId && !m.text.includes(`<@${botUserId}>`))
    .map((m) => {
      const name = userNames[m.user] ?? m.user;
      const clean = stripMention(m.text, botUserId);
      return `${name}: ${clean}`;
    })
    .filter((l) => l.trim());

  return lines.join("\n");
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
      console.error("No workspace found for Slack team:", teamId, lookupError);
      return new Response("OK", { status: 200 });
    }

    const config = integration.config as Record<string, string>;
    const botUserId = config?.bot_user_id ?? "";
    const botToken = integration.access_token;

    // Determine if this is a thread mention
    const isThread = !!event.thread_ts;
    const threadTs = event.thread_ts ?? event.ts;
    const replyTs = event.thread_ts ?? event.ts; // Reply in the thread

    // Parse the mention text for the title
    const cleanText = stripMention(event.text ?? "", botUserId);
    const titleSource = cleanText || "Slack request";
    const title =
      titleSource.length > 120
        ? titleSource.slice(0, 117) + "..."
        : titleSource;

    // Build description: if in a thread, capture the full thread context
    let description: string;
    if (isThread) {
      const threadContent = await buildThreadDescription(
        botToken,
        event.channel,
        event.thread_ts,
        botUserId
      );
      description = threadContent || cleanText;
    } else {
      description = cleanText;
    }

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
          _slack_thread_ts: isThread ? event.thread_ts : null,
          _slack_user: event.user,
          _slack_user_name: slackUserName,
          _slack_team_id: teamId,
          _slack_is_thread: isThread,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create content item:", insertError);
      await postSlackMessage(
        botToken,
        event.channel,
        replyTs,
        "Sorry, I couldn't create that item. Please try again or create it directly in ContentedCal."
      );
      return new Response("OK", { status: 200 });
    }

    const itemUrl = `${APP_URL}/list?item=${newItem.id}`;
    const fromLine = slackUserName ? ` from ${slackUserName}` : "";
    const threadNote = isThread ? " (thread captured)" : "";
    await postSlackMessage(
      botToken,
      event.channel,
      replyTs,
      `Got it! Created *${title}*${fromLine}${threadNote}.\n<${itemUrl}|View in ContentedCal>`
    );

    return new Response("OK", { status: 200 });
  }

  return new Response("OK", { status: 200 });
});
