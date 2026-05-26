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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    return data.ok ? data.user?.real_name || data.user?.name || null : null;
  } catch {
    return null;
  }
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

  // Slack sends interactions as application/x-www-form-urlencoded with a `payload` field
  const params = new URLSearchParams(body);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return new Response("Missing payload", { status: 400 });
  }

  const payload = JSON.parse(payloadStr);

  // ── Message shortcut: "Add to Content Calendar" ────────────────────────

  if (
    payload.type === "message_action" &&
    payload.callback_id === "message_to_content_request"
  ) {
    const teamId: string = payload.team?.id ?? "";
    const message = payload.message;
    const triggeredBy = payload.user;
    const channel = payload.channel;

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

    // Extract content from the message
    const messageText: string = message?.text ?? "";
    const firstLine = messageText.split("\n")[0]?.trim() ?? "Slack request";
    const title =
      firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine;

    // Look up who sent the original message
    const authorName = message?.user
      ? await getSlackUserName(botToken, message.user)
      : null;

    // Get the default board column
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
        description: messageText,
        status: defaultStatus,
        tags: ["slack-request"],
        custom_fields: {
          _source: "slack",
          _slack_channel: channel?.id,
          _slack_ts: message?.ts,
          _slack_user: message?.user,
          _slack_user_name: authorName,
          _slack_team_id: teamId,
          _slack_added_by: triggeredBy?.id,
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
    const fromLine = authorName ? ` (from ${authorName})` : "";

    // Reply in the thread of the original message
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channel?.id,
        thread_ts: message?.ts,
        text: `Added to the content calendar${fromLine}: *${title}*\n<${itemUrl}|View in ContentedCal>`,
      }),
    });

    // Ephemeral confirmation to the person who triggered the shortcut
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: `Added to content calendar: *${title}*\n<${itemUrl}|View in ContentedCal>`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Message shortcut: "Add as Project" ─────────────────────────────────

  if (
    payload.type === "message_action" &&
    payload.callback_id === "message_to_project"
  ) {
    const teamId: string = payload.team?.id ?? "";
    const message = payload.message;
    const triggeredBy = payload.user;
    const channel = payload.channel;

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

    // Extract content from the message
    const messageText: string = message?.text ?? "";
    const firstLine = messageText.split("\n")[0]?.trim() ?? "Slack project";
    const title =
      firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine;

    // Look up who sent the original message
    const authorName = message?.user
      ? await getSlackUserName(botToken, message.user)
      : null;

    // Create the project
    const { data: newProject, error: insertError } = await supabase
      .from("projects")
      .insert({
        workspace_id: integration.workspace_id,
        title,
        description: messageText,
        status: "active",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create project:", insertError);
      return new Response(
        JSON.stringify({
          response_type: "ephemeral",
          text: "Sorry, I couldn't create that project. Please try again.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const projectUrl = `${APP_URL}/projects`;
    const fromLine = authorName ? ` (from ${authorName})` : "";

    // Reply in the thread of the original message
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channel?.id,
        thread_ts: message?.ts,
        text: `📁 Created project${fromLine}: *${title}*\n<${projectUrl}|View in ContentedCal>`,
      }),
    });

    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: `Project created: *${title}*\n<${projectUrl}|View in ContentedCal>`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Unknown interaction type — acknowledge
  return new Response("", { status: 200 });
});
