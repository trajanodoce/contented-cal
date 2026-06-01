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

function parseProjectPrefix(text: string): { isProject: boolean; cleanText: string } {
  const match = text.match(/^project[:\s]\s*(.*)/i);
  if (match) return { isProject: true, cleanText: match[1].trim() };
  return { isProject: false, cleanText: text };
}

async function getSlackUserInfo(
  botToken: string,
  userId: string
): Promise<{ name: string | null; email: string | null }> {
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json();
    if (!data.ok) return { name: null, email: null };
    return {
      name: data.user?.real_name || data.user?.name || null,
      email: data.user?.profile?.email || null,
    };
  } catch {
    return { name: null, email: null };
  }
}

async function getSlackUserName(botToken: string, userId: string): Promise<string | null> {
  const { name } = await getSlackUserInfo(botToken, userId);
  return name;
}

function isMyTasksQuery(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/^[^a-z]+/, '');
  const patterns = [
    /^(what\s+are\s+)?my\s+tasks\??$/,
    /^show\s+(me\s+)?my\s+tasks\??$/,
    /^my\s+work\??$/,
    /^tasks\??$/,
    /^what('s|s)?\s+(on\s+)?my\s+(plate|list|agenda)\??$/,
    /^what\s+do\s+i\s+have\??$/,
    /^what('s|s)?\s+assigned\s+to\s+me\??$/,
  ];
  return patterns.some((p) => p.test(normalized));
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diff < 0) return ` — :warning: *overdue* (${formatted})`;
  if (diff === 0) return ` — :rotating_light: *due today*`;
  if (diff === 1) return ` — due tomorrow`;
  if (diff <= 7) return ` — due ${formatted}`;
  return ` — ${formatted}`;
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

// ── Thread capture ──────────────────────────────────────────────────────────

interface SlackMessage {
  user?: string;
  text?: string;
  ts?: string;
  files?: Array<{ name?: string; url_private?: string }>;
}

async function getThreadReplies(
  botToken: string,
  channel: string,
  threadTs: string
): Promise<SlackMessage[]> {
  try {
    const res = await fetch(
      `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}&limit=100`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
    const data = await res.json();
    if (!data.ok || !data.messages) return [];
    return data.messages;
  } catch {
    return [];
  }
}

async function getChannelName(botToken: string, channelId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://slack.com/api/conversations.info?channel=${channelId}`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
    const data = await res.json();
    return data.ok ? data.channel?.name ?? null : null;
  } catch {
    return null;
  }
}

async function buildThreadDescription(
  botToken: string,
  messages: SlackMessage[],
  botUserId: string
): Promise<{ description: string; snapshot: SlackMessage[] }> {
  if (messages.length === 0) return { description: "", snapshot: [] };

  // Resolve user names
  const userIds = [...new Set(messages.map((m) => m.user).filter(Boolean))] as string[];
  const userNames: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (uid) => {
      const name = await getSlackUserName(botToken, uid);
      if (name) userNames[uid] = name;
    })
  );

  // Apply truncation: first 5 + last 20 if > 50 messages
  let displayMessages = messages;
  let omittedCount = 0;
  if (messages.length > 50) {
    const head = messages.slice(0, 5);
    const tail = messages.slice(-20);
    omittedCount = messages.length - 25;
    displayMessages = [...head, { text: `[…${omittedCount} messages omitted…]` } as SlackMessage, ...tail];
  }

  const lines = displayMessages
    .filter((m) => m.user !== botUserId)
    .map((m) => {
      if (!m.user && m.text?.startsWith("[…")) return m.text; // omitted marker
      const name = m.user ? (userNames[m.user] ?? m.user) : "Unknown";
      const ts = m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString().replace("T", " ").slice(0, 16) : "";
      const clean = stripMention(m.text ?? "", botUserId);
      const attachments = (m.files ?? []).map((f) => `📎 ${f.name ?? "file"}`).join("\n");
      return `[${ts}] ${name}:\n${clean}${attachments ? "\n" + attachments : ""}`;
    })
    .filter((l) => l.trim());

  return { description: lines.join("\n\n"), snapshot: messages };
}

// ── My Tasks handler ────────────────────────────────────────────────────────

async function handleMyTasks(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  channel: string,
  replyTs: string,
  slackUserId: string,
  workspaceId: string
): Promise<void> {
  const { name: slackName, email: slackEmail } = await getSlackUserInfo(botToken, slackUserId);

  if (!slackEmail) {
    await postSlackMessage(botToken, channel, replyTs,
      "I couldn't find an email address for your Slack account. Make sure your email is visible in your Slack profile.");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles").select("id").eq("email", slackEmail).maybeSingle();

  if (!profile) {
    await postSlackMessage(botToken, channel, replyTs,
      `I couldn't find a ContentedCal account for *${slackEmail}*. Make sure you're signed up with the same email you use in Slack.`);
    return;
  }

  const { data: items, error } = await supabase
    .from("content_items")
    .select("id, title, status, due_date, priority")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .contains("assignee_ids", [profile.id])
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error querying tasks:", error);
    await postSlackMessage(botToken, channel, replyTs,
      "Sorry, something went wrong looking up your tasks. Please try again.");
    return;
  }

  if (!items || items.length === 0) {
    await postSlackMessage(botToken, channel, replyTs,
      `No tasks assigned to you right now${slackName ? `, ${slackName}` : ""}. :tada:`);
    return;
  }

  const { data: columns } = await supabase
    .from("board_columns").select("id, name").eq("workspace_id", workspaceId);

  const columnMap: Record<string, string> = {};
  for (const col of columns ?? []) columnMap[col.id] = col.name;

  const priorityEmoji: Record<string, string> = {
    urgent: ":red_circle:", high: ":large_orange_circle:",
    medium: ":large_yellow_circle:", low: ":white_circle:",
  };

  const taskLines = items.map((item, i) => {
    const pEmoji = priorityEmoji[item.priority] ?? "";
    const statusTag = columnMap[item.status] ? ` \`${columnMap[item.status]}\`` : "";
    const due = formatDueDate(item.due_date);
    const link = `<${APP_URL}/list?item=${item.id}|${item.title}>`;
    return `${i + 1}. ${pEmoji} ${link}${statusTag}${due}`;
  });

  const overdue = items.filter((i) => {
    if (!i.due_date) return false;
    return new Date(i.due_date + "T00:00:00") < new Date(new Date().toDateString());
  }).length;

  const header = slackName ? `Here are your tasks, ${slackName}:` : "Here are your tasks:";
  const summary = overdue > 0
    ? `\n\n:warning: *${overdue} overdue* out of ${items.length} total`
    : `\n${items.length} task${items.length !== 1 ? "s" : ""} total`;

  await postSlackMessage(botToken, channel, replyTs,
    `${header}\n\n${taskLines.join("\n")}${summary}\n\n<${APP_URL}/my-work|Open My Work in ContentedCal>`);
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";
  const payload = JSON.parse(body);

  // URL verification challenge
  if (payload.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify signature
  const valid = await verifySlackSignature(body, timestamp, signature);
  if (!valid) {
    console.error("Invalid Slack signature");
    return new Response("Invalid signature", { status: 401 });
  }

  // ── Event callback ─────────────────────────────────────────────────────
  if (payload.type === "event_callback") {
    const event = payload.event;

    // Handle app_mention (channels) and message (DMs)
    const isDM = event?.type === "message" && event?.channel_type === "im";
    if (event?.type !== "app_mention" && !isDM) {
      return new Response("OK", { status: 200 });
    }

    // Ignore bot messages
    if (event.bot_id || event.subtype) {
      return new Response("OK", { status: 200 });
    }

    const teamId: string = payload.team_id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up connected workspace
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

    // Thread detection
    const isThread = !!event.thread_ts;
    const threadTs = event.thread_ts ?? event.ts;
    const replyTs = event.thread_ts ?? event.ts;

    // Parse mention text
    const rawText = stripMention(event.text ?? "", botUserId);

    // ── "My tasks" query ─────────────────────────────────────────────────
    if (isMyTasksQuery(rawText)) {
      await handleMyTasks(supabase, botToken, event.channel, replyTs, event.user, integration.workspace_id);
      return new Response("OK", { status: 200 });
    }

    // ── Thread dedup: check if this thread already has a linked item ─────
    const { data: existingLink } = await supabase
      .from("slack_thread_links")
      .select("content_item_id")
      .eq("slack_channel_id", event.channel)
      .eq("slack_thread_ts", threadTs)
      .maybeSingle();

    if (existingLink) {
      // ── Subsequent @mention in same thread → add as comment ────────────
      const slackUserName = await getSlackUserName(botToken, event.user);
      const commentBody = `**${slackUserName ?? "Someone"} via Slack:**\n${rawText}`;

      await supabase.from("comments").insert({
        content_item_id: existingLink.content_item_id,
        user_id: null, // Slack-originated comment, no CC user mapping yet
        body: commentBody,
      });

      // Get item title for the reply
      const { data: existingItem } = await supabase
        .from("content_items")
        .select("title")
        .eq("id", existingLink.content_item_id)
        .maybeSingle();

      const itemUrl = `${APP_URL}/list?item=${existingLink.content_item_id}`;
      await postSlackMessage(botToken, event.channel, replyTs,
        `💬 Added to ContentedCal — *${existingItem?.title ?? "item"}*\n<${itemUrl}|View in ContentedCal>`);

      return new Response("OK", { status: 200 });
    }

    // ── First @mention → create new item ─────────────────────────────────
    const { isProject, cleanText } = parseProjectPrefix(rawText);

    // Build title from parent message (if thread) or mention text
    let title: string;
    let description: string;
    let threadSnapshot: SlackMessage[] = [];

    if (isThread) {
      const messages = await getThreadReplies(botToken, event.channel, threadTs);
      const parentMsg = messages[0];
      const parentText = parentMsg ? stripMention(parentMsg.text ?? "", botUserId) : "";

      // Title: parent message first line, or clean text from mention
      const titleSource = parentText.split("\n")[0]?.trim() || cleanText || (isProject ? "Slack project" : "Slack request");
      title = titleSource.length > 120 ? titleSource.slice(0, 117) + "..." : titleSource;

      // Description: full thread context
      const result = await buildThreadDescription(botToken, messages, botUserId);
      description = result.description || cleanText;
      threadSnapshot = result.snapshot;
    } else {
      const titleSource = cleanText || (isProject ? "Slack project" : "Slack request");
      title = titleSource.length > 120 ? titleSource.slice(0, 117) + "..." : titleSource;
      description = cleanText;
    }

    const slackUserName = await getSlackUserName(botToken, event.user);
    const channelName = await getChannelName(botToken, event.channel);
    const permalink = `https://slack.com/archives/${event.channel}/p${threadTs.replace(".", "")}`;

    if (isProject) {
      // ── Create a project ───────────────────────────────────────────────
      const { data: newProject, error: insertError } = await supabase
        .from("projects")
        .insert({ workspace_id: integration.workspace_id, title, description, status: "active" })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to create project:", insertError);
        await postSlackMessage(botToken, event.channel, replyTs,
          "Sorry, I couldn't create that project. Please try again or create it directly in ContentedCal.");
        return new Response("OK", { status: 200 });
      }

      const fromLine = slackUserName ? ` from ${slackUserName}` : "";
      const threadNote = isThread ? " (thread captured)" : "";
      await postSlackMessage(botToken, event.channel, replyTs,
        `📁 Created project *${title}*${fromLine}${threadNote}.\n<${APP_URL}/projects|View in ContentedCal>`);
    } else {
      // ── Create a content item ──────────────────────────────────────────
      const { data: columns } = await supabase
        .from("board_columns")
        .select("id")
        .eq("workspace_id", integration.workspace_id)
        .order("position", { ascending: true })
        .limit(1);

      const defaultStatus = columns?.[0]?.id ?? null;

      const { data: newItem, error: insertError } = await supabase
        .from("content_items")
        .insert({
          workspace_id: integration.workspace_id,
          title,
          description,
          status: defaultStatus,
          needs_triage: true,
          tags: ["slack-request"],
          custom_fields: {
            _source: "slack",
            _slack_channel: event.channel,
            _slack_ts: event.ts,
            _slack_thread_ts: threadTs,
            _slack_user: event.user,
            _slack_user_name: slackUserName,
            _slack_team_id: teamId,
            _slack_is_thread: isThread,
            _slack_via: isDM ? "dm" : "mention",
            _slack_permalink: permalink,
          },
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to create content item:", insertError);
        await postSlackMessage(botToken, event.channel, replyTs,
          "Sorry, I couldn't create that item. Please try again or create it directly in ContentedCal.");
        return new Response("OK", { status: 200 });
      }

      // ── Insert slack_thread_links row (origin) ─────────────────────────
      await supabase.from("slack_thread_links").insert({
        content_item_id: newItem.id,
        slack_channel_id: event.channel,
        slack_thread_ts: threadTs,
        permalink,
        channel_name: channelName,
        parent_message: isThread ? (threadSnapshot[0]?.text ?? null) : (cleanText || null),
        parent_author_id: isThread ? (threadSnapshot[0]?.user ?? null) : event.user,
        parent_author_name: isThread ? null : slackUserName, // resolved later for thread parents
        requester_id: event.user,
        requester_name: slackUserName,
        participant_count: isThread ? new Set(threadSnapshot.map(m => m.user).filter(Boolean)).size : 1,
        thread_start_at: new Date(parseFloat(threadTs) * 1000).toISOString(),
        is_origin: true,
        raw_thread_snapshot: isThread ? threadSnapshot : null,
      }).then(({ error }) => {
        if (error) console.error("Failed to insert slack_thread_links:", error);
      });

      const itemUrl = `${APP_URL}/intake-queue?item=${newItem.id}`;
      const threadNote = isThread ? " (thread captured)" : "";
      await postSlackMessage(botToken, event.channel, replyTs,
        `:eyes: Submitted for review: *${title}*${threadNote}. You'll see it on the calendar once approved.\n<${itemUrl}|View status>`);
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("OK", { status: 200 });
});
