import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRANOLA_API_BASE = "https://public-api.granola.ai";

// ── Types ────────────────────────────────────────────────────────────────────

interface GranolaUser {
  name: string | null;
  email: string;
}

interface GranolaCalendarEvent {
  title: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface GranolaFolder {
  id: string;
  name: string;
}

interface GranolaNoteSummary {
  id: string;
  title: string | null;
  owner: GranolaUser;
  created_at: string;
  updated_at: string;
}

interface GranolaNoteDetail {
  id: string;
  title: string | null;
  owner: GranolaUser;
  created_at: string;
  updated_at: string;
  web_url: string | null;
  calendar_event: GranolaCalendarEvent | null;
  attendees: GranolaUser[];
  folder_membership: GranolaFolder[];
  summary_text: string | null;
  summary_markdown: string | null;
}

interface GranolaListResponse {
  notes: GranolaNoteSummary[];
  hasMore: boolean;
  cursor: string | null;
}

type Action = "fetch" | "sync" | "link";

interface RequestBody {
  action: Action;
  workspace_id: string;
  // For "fetch": optional filters
  updated_after?: string;
  cursor?: string;
  page_size?: number;
  // For "link": required
  granola_note_id?: string;
  content_item_id?: string;
  // For "sync": no extra params needed
}

// ── Granola API helpers ──────────────────────────────────────────────────────

async function granolaFetch(
  path: string,
  apiKey: string,
  params?: Record<string, string>
): Promise<Response> {
  const url = new URL(`${GRANOLA_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
}

async function listNotes(
  apiKey: string,
  opts: { updated_after?: string; cursor?: string; page_size?: number } = {}
): Promise<GranolaListResponse> {
  const params: Record<string, string> = {};
  if (opts.updated_after) params.updated_after = opts.updated_after;
  if (opts.cursor) params.cursor = opts.cursor;
  if (opts.page_size) params.page_size = String(opts.page_size);

  const res = await granolaFetch("/v1/notes", apiKey, params);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Granola API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getNote(
  apiKey: string,
  noteId: string
): Promise<GranolaNoteDetail> {
  const res = await granolaFetch(`/v1/notes/${noteId}`, apiKey);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Granola API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonErr(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Auth: get current user via Supabase JWT ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Missing authorization", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonErr("Unauthorized", 401);

    // ── Parse request ────────────────────────────────────────────────────
    const body = (await req.json()) as RequestBody;
    const { action, workspace_id } = body;

    if (!workspace_id) return jsonErr("workspace_id is required");

    // ── Look up the user's Granola API key ───────────────────────────────
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .eq("platform", "granola")
      .maybeSingle();

    if (!integration?.access_token) {
      return jsonErr(
        "Granola not connected. Add your API key in Settings → Integrations.",
        400
      );
    }

    const apiKey = integration.access_token;

    // ── ACTION: fetch ────────────────────────────────────────────────────
    // Returns a paginated list of the user's Granola notes (for browsing)
    if (action === "fetch") {
      const result = await listNotes(apiKey, {
        updated_after: body.updated_after,
        cursor: body.cursor,
        page_size: body.page_size ?? 20,
      });
      return jsonOk(result);
    }

    // ── ACTION: link ─────────────────────────────────────────────────────
    // Fetches full note details from Granola and stores in granola_note_links
    if (action === "link") {
      const { granola_note_id, content_item_id } = body;
      if (!granola_note_id || !content_item_id) {
        return jsonErr("granola_note_id and content_item_id are required");
      }

      // Fetch full note details from Granola
      const note = await getNote(apiKey, granola_note_id);

      // Upsert into granola_note_links (unique on granola_note_id + content_item_id)
      const { data: linkData, error: linkError } = await supabase
        .from("granola_note_links")
        .upsert(
          {
            granola_note_id: note.id,
            content_item_id,
            owner_id: user.id,
            note_title: note.title,
            web_url: note.web_url,
            meeting_start: note.calendar_event?.start_time ?? null,
            meeting_end: note.calendar_event?.end_time ?? null,
            attendees: note.attendees ?? [],
            granola_folder:
              note.folder_membership?.[0]?.name ?? null,
            summary_text: note.summary_text,
            summary_markdown: note.summary_markdown,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "granola_note_id" }
        )
        .select()
        .single();

      if (linkError) {
        return jsonErr(`Failed to link note: ${linkError.message}`);
      }

      return jsonOk({ linked: linkData });
    }

    // ── ACTION: sync ─────────────────────────────────────────────────────
    // Refreshes metadata for all notes already linked by this user
    if (action === "sync") {
      // Get all linked notes for this user in this workspace
      const { data: existingLinks, error: fetchErr } = await supabase
        .from("granola_note_links")
        .select("id, granola_note_id")
        .eq("owner_id", user.id);

      if (fetchErr) {
        return jsonErr(`Failed to fetch existing links: ${fetchErr.message}`);
      }

      if (!existingLinks || existingLinks.length === 0) {
        return jsonOk({ synced: 0, message: "No linked notes to sync" });
      }

      let synced = 0;
      const errors: string[] = [];

      // Refresh each linked note from the Granola API
      for (const link of existingLinks) {
        try {
          const note = await getNote(apiKey, link.granola_note_id);

          await supabase
            .from("granola_note_links")
            .update({
              note_title: note.title,
              web_url: note.web_url,
              meeting_start: note.calendar_event?.start_time ?? null,
              meeting_end: note.calendar_event?.end_time ?? null,
              attendees: note.attendees ?? [],
              granola_folder:
                note.folder_membership?.[0]?.name ?? null,
              summary_text: note.summary_text,
              summary_markdown: note.summary_markdown,
              synced_at: new Date().toISOString(),
            })
            .eq("id", link.id);

          synced++;
        } catch (e) {
          errors.push(
            `Note ${link.granola_note_id}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }

      return jsonOk({
        synced,
        total: existingLinks.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return jsonErr(`Unknown action: ${action}`);
  } catch (err) {
    return jsonErr(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
