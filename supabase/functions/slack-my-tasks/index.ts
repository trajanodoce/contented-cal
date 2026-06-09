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
  const userId = params.get("user_id") ?? "";
  const teamId = params.get("team_id") ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the connected workspace
  const { data: integration, error: lookupError } = await supabase
    .from("integrations")
    .select("id, workspace_id, access_token")
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

  // ── Resolve Slack user → email → ContentedCal profile ─────────────────

  let userName: string | null = null;
  let userEmail: string | null = null;
  try {
    const res = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
    const data = await res.json();
    if (data.ok) {
      userName = data.user?.real_name || data.user?.name || null;
      userEmail = data.user?.profile?.email || null;
    }
  } catch {
    // non-critical
  }

  if (!userEmail) {
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: "I couldn't find an email address for your Slack account. Make sure your email is visible in your Slack profile.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Look up ContentedCal profile by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", userEmail)
    .maybeSingle();

  if (!profile) {
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: `I couldn't find a ContentedCal account for *${userEmail}*. Make sure you're signed up with the same email you use in Slack.`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Query assigned content items ──────────────────────────────────────

  const { data: items, error: queryError } = await supabase
    .from("content_items")
    .select("id, title, status, due_date, priority")
    .eq("workspace_id", integration.workspace_id)
    .eq("archived", false)
    .contains("assignee_ids", [profile.id])
    .order("due_date", { ascending: true, nullsFirst: false });

  if (queryError) {
    console.error("Error querying tasks:", queryError);
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: "Sorry, something went wrong looking up your tasks. Please try again.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (!items || items.length === 0) {
    return new Response(
      JSON.stringify({
        response_type: "ephemeral",
        text: `No tasks assigned to you right now${userName ? `, ${userName}` : ""}. :tada:`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Format response ───────────────────────────────────────────────────

  // Get column names for status display
  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name")
    .eq("workspace_id", integration.workspace_id);

  const columnMap: Record<string, string> = {};
  for (const col of columns ?? []) columnMap[col.id] = col.name;

  const priorityEmoji: Record<string, string> = {
    urgent: ":red_circle:",
    high: ":large_orange_circle:",
    medium: ":large_yellow_circle:",
    low: ":white_circle:",
  };

  const taskLines = items.map((item, i) => {
    const pEmoji = priorityEmoji[item.priority] ?? "";
    const statusName = columnMap[item.status] ?? "";
    const statusTag = statusName ? ` \`${statusName}\`` : "";

    let due = "";
    if (item.due_date) {
      const d = new Date(item.due_date + "T00:00:00");
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
      const fmt = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (diff < 0) due = ` — :warning: *overdue* (${fmt})`;
      else if (diff === 0) due = ` — :rotating_light: *due today*`;
      else if (diff === 1) due = ` — due tomorrow`;
      else if (diff <= 7) due = ` — due ${fmt}`;
      else due = ` — ${fmt}`;
    }

    const link = `<${APP_URL}/list?item=${item.id}|${item.title}>`;
    return `${i + 1}. ${pEmoji} ${link}${statusTag}${due}`;
  });

  const overdue = items.filter((i) => {
    if (!i.due_date) return false;
    return new Date(i.due_date + "T00:00:00") < new Date(new Date().toDateString());
  }).length;

  const header = userName
    ? `Here are your tasks, ${userName}:`
    : "Here are your tasks:";

  const summary =
    overdue > 0
      ? `\n\n:warning: *${overdue} overdue* out of ${items.length} total`
      : `\n${items.length} task${items.length !== 1 ? "s" : ""} total`;

  return new Response(
    JSON.stringify({
      response_type: "ephemeral",
      text: `${header}\n\n${taskLines.join("\n")}${summary}\n\n<${APP_URL}/my-work|Open My Work in ContentedCal>`,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
