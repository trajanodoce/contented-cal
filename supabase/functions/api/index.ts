import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status: number, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

// ── Rate limiter (in-memory, approximate) ───────────────────────────────────
const rateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

function checkRate(keyPrefix: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(keyPrefix);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateMap.set(keyPrefix, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ── Scope check ─────────────────────────────────────────────────────────────
const SCOPE_LEVEL: Record<string, number> = { read: 1, read_write: 2, full: 3 };

function hasScope(actual: string, minimum: string): boolean {
  return (SCOPE_LEVEL[actual] ?? 0) >= (SCOPE_LEVEL[minimum] ?? 99);
}

// ── SHA-256 helper ──────────────────────────────────────────────────────────
async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Supabase client (service role — bypasses RLS; auth is via API key)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // ── Authenticate ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.startsWith("cc_sk_")) {
    return err("Missing or invalid Authorization header. Expected: Bearer cc_sk_...", 401, "AUTH_MISSING");
  }

  const keyHash = await sha256hex(token);
  const { data: authRow, error: authErr } = await sb.rpc("authenticate_api_key", { p_key_hash: keyHash });

  if (authErr || !authRow || authRow.length === 0) {
    return err("Invalid or revoked API key", 401, "AUTH_INVALID");
  }

  const { workspace_id: wsId, scope } = authRow[0];

  // Rate limit
  const prefix = token.slice(0, 12);
  if (!checkRate(prefix)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMITED" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  // ── Route parsing ───────────────────────────────────────────────────────
  const url = new URL(req.url);
  // Edge function name is "api", paths arrive as /api/items/... or /api/types etc
  const pathParts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = pathParts[0] || "";
  const resourceId = pathParts[1] || "";
  const method = req.method;

  // ── Items ───────────────────────────────────────────────────────────────
  if (resource === "items") {
    // GET /items or GET /items/:id
    if (method === "GET") {
      if (!hasScope(scope, "read")) return err("Insufficient scope", 403, "SCOPE_DENIED");

      if (resourceId) {
        // Single item
        const { data, error } = await sb
          .from("content_items")
          .select("*, content_types(id, name, icon, color), board_columns:status(id, name, color)")
          .eq("id", resourceId)
          .eq("workspace_id", wsId)
          .maybeSingle();

        if (error) return err(error.message, 500);
        if (!data) return err("Item not found", 404, "NOT_FOUND");
        return json({ data });
      }

      // List items with optional filters
      let query = sb
        .from("content_items")
        .select("*, content_types(id, name, icon, color), board_columns:status(id, name, color)", { count: "exact" })
        .eq("workspace_id", wsId)
        .eq("archived", false);

      const params = url.searchParams;
      if (params.get("status")) query = query.eq("status", params.get("status")!);
      if (params.get("content_type_id")) query = query.eq("content_type_id", params.get("content_type_id")!);
      if (params.get("channel")) query = query.eq("channel", params.get("channel")!);
      if (params.get("project_id")) query = query.eq("project_id", params.get("project_id")!);
      if (params.get("priority")) query = query.eq("priority", params.get("priority")!);
      if (params.get("assignee_id")) query = query.contains("assignee_ids", [params.get("assignee_id")!]);

      const limit = Math.min(parseInt(params.get("limit") || "50"), 200);
      const offset = parseInt(params.get("offset") || "0");
      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) return err(error.message, 500);
      return json({ data, count, limit, offset });
    }

    // POST /items
    if (method === "POST") {
      if (!hasScope(scope, "read_write")) return err("Insufficient scope — requires read_write or full", 403, "SCOPE_DENIED");

      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return err("Invalid JSON body", 400, "BAD_REQUEST"); }

      if (!body.title || typeof body.title !== "string") {
        return err("title is required", 400, "VALIDATION");
      }

      // Validate content_type_id belongs to workspace
      if (body.content_type_id) {
        const { data: ct } = await sb.from("content_types").select("id").eq("id", body.content_type_id).eq("workspace_id", wsId).maybeSingle();
        if (!ct) return err("Invalid content_type_id for this workspace", 400, "VALIDATION");
      }

      // Validate status (board column) belongs to workspace
      if (body.status) {
        const { data: col } = await sb.from("board_columns").select("id").eq("id", body.status).eq("workspace_id", wsId).maybeSingle();
        if (!col) return err("Invalid status (board_column id) for this workspace", 400, "VALIDATION");
      }

      const insert: Record<string, unknown> = {
        workspace_id: wsId,
        title: body.title,
        description: body.description ?? null,
        content_type_id: body.content_type_id ?? null,
        status: body.status ?? null,
        channel: body.channel ?? null,
        assignee_ids: body.assignee_ids ?? null,
        due_date: body.due_date ?? null,
        publish_date: body.publish_date ?? null,
        priority: body.priority ?? null,
        tags: body.tags ?? null,
        project_id: body.project_id ?? null,
        custom_fields: body.custom_fields ?? null,
      };

      const { data, error } = await sb.from("content_items").insert(insert).select().single();
      if (error) return err(error.message, 500);
      return json({ data }, 201);
    }

    // PATCH /items/:id
    if (method === "PATCH" && resourceId) {
      if (!hasScope(scope, "read_write")) return err("Insufficient scope — requires read_write or full", 403, "SCOPE_DENIED");

      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return err("Invalid JSON body", 400, "BAD_REQUEST"); }

      // Verify item belongs to workspace
      const { data: existing } = await sb.from("content_items").select("id").eq("id", resourceId).eq("workspace_id", wsId).maybeSingle();
      if (!existing) return err("Item not found", 404, "NOT_FOUND");

      // Allow only known fields
      const allowed = ["title", "description", "content_type_id", "status", "channel", "assignee_ids", "due_date", "publish_date", "priority", "tags", "project_id", "custom_fields", "archived"];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in body) updates[key] = body[key];
      }

      if (Object.keys(updates).length === 0) return err("No valid fields to update", 400, "VALIDATION");

      const { data, error } = await sb.from("content_items").update(updates).eq("id", resourceId).select().single();
      if (error) return err(error.message, 500);
      return json({ data });
    }

    // DELETE /items/:id
    if (method === "DELETE" && resourceId) {
      if (!hasScope(scope, "full")) return err("Insufficient scope — requires full access", 403, "SCOPE_DENIED");

      const { data: existing } = await sb.from("content_items").select("id").eq("id", resourceId).eq("workspace_id", wsId).maybeSingle();
      if (!existing) return err("Item not found", 404, "NOT_FOUND");

      const { error } = await sb.from("content_items").delete().eq("id", resourceId);
      if (error) return err(error.message, 500);
      return new Response(null, { status: 204, headers: corsHeaders });
    }
  }

  // ── Content types ─────────────────────────────────────────────────────────
  if (resource === "types" && method === "GET") {
    if (!hasScope(scope, "read")) return err("Insufficient scope", 403, "SCOPE_DENIED");
    const { data, error } = await sb.from("content_types").select("id, name, icon, color").eq("workspace_id", wsId).order("name");
    if (error) return err(error.message, 500);
    return json({ data });
  }

  // ── Statuses (board columns) ──────────────────────────────────────────────
  if (resource === "statuses" && method === "GET") {
    if (!hasScope(scope, "read")) return err("Insufficient scope", 403, "SCOPE_DENIED");
    const { data, error } = await sb.from("board_columns").select("id, name, color, position").eq("workspace_id", wsId).order("position");
    if (error) return err(error.message, 500);
    return json({ data });
  }

  // ── 404 fallback ──────────────────────────────────────────────────────────
  return err(`Unknown endpoint: ${method} /${resource}${resourceId ? "/" + resourceId : ""}`, 404, "NOT_FOUND");
});
