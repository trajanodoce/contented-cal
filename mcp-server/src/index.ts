#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Config ──────────────────────────────────────────────────────────────────
const API_URL = process.env.CONTENTEDCAL_API_URL || "https://riizkhddtaacmcymbeqo.supabase.co/functions/v1/api";
const API_KEY = process.env.CONTENTEDCAL_API_KEY || "";

if (!API_KEY) {
  console.error("CONTENTEDCAL_API_KEY environment variable is required");
  process.exit(1);
}

// ── HTTP helper ─────────────────────────────────────────────────────────────
async function api(
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body && (method === "POST" || method === "PATCH")) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, opts);

  if (res.status === 204) {
    return { status: 204, data: { success: true } };
  }

  const data = await res.json();
  return { status: res.status, data };
}

function formatResponse(result: { status: number; data: unknown }): string {
  if (result.status >= 200 && result.status < 300) {
    return JSON.stringify(result.data, null, 2);
  }
  return `Error (${result.status}): ${JSON.stringify(result.data, null, 2)}`;
}

// ── MCP Server ──────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "contentedcal",
  version: "1.0.0",
});

// ── Tools ───────────────────────────────────────────────────────────────────

server.tool(
  "list_items",
  "List content items from the calendar. Supports filtering by status, content type, channel, project, priority, or assignee. Returns up to 200 items per page.",
  {
    status: z.string().optional().describe("Board column ID to filter by status"),
    content_type_id: z.string().optional().describe("Content type ID to filter by"),
    channel: z.string().optional().describe("Channel name to filter by (e.g. 'Blog', 'Social')"),
    project_id: z.string().optional().describe("Project ID to filter by"),
    priority: z.string().optional().describe("Priority level: low, medium, high, or urgent"),
    assignee_id: z.string().optional().describe("User ID to filter by assignee"),
    limit: z.number().optional().describe("Max items to return (default 50, max 200)"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async (params) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.content_type_id) query.set("content_type_id", params.content_type_id);
    if (params.channel) query.set("channel", params.channel);
    if (params.project_id) query.set("project_id", params.project_id);
    if (params.priority) query.set("priority", params.priority);
    if (params.assignee_id) query.set("assignee_id", params.assignee_id);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));

    const qs = query.toString();
    const result = await api(`/items${qs ? `?${qs}` : ""}`);
    return { content: [{ type: "text" as const, text: formatResponse(result) }] };
  }
);

server.tool(
  "get_item",
  "Get a single content item by ID, including its content type and status details.",
  {
    id: z.string().describe("The content item ID (UUID)"),
  },
  async (params) => {
    const result = await api(`/items/${params.id}`);
    return { content: [{ type: "text" as const, text: formatResponse(result) }] };
  }
);

server.tool(
  "create_item",
  "Create a new content item in the calendar. Only title is required — all other fields are optional.",
  {
    title: z.string().describe("Title of the content item (required)"),
    description: z.string().optional().describe("Description or body text"),
    content_type_id: z.string().optional().describe("Content type ID (use list_types to find valid IDs)"),
    status: z.string().optional().describe("Board column ID for status (use list_statuses to find valid IDs)"),
    channel: z.string().optional().describe("Channel name (e.g. 'Blog', 'Social', 'Newsletter/Email')"),
    assignee_ids: z.array(z.string()).optional().describe("Array of user IDs to assign"),
    due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
    publish_date: z.string().optional().describe("Publish date in YYYY-MM-DD format"),
    priority: z.string().optional().describe("Priority: low, medium, high, or urgent"),
    tags: z.array(z.string()).optional().describe("Array of tag strings"),
    project_id: z.string().optional().describe("Project ID to associate with"),
    custom_fields: z.record(z.string(), z.unknown()).optional().describe("Custom field values as key-value pairs"),
  },
  async (params) => {
    const body: Record<string, unknown> = { title: params.title };
    if (params.description !== undefined) body.description = params.description;
    if (params.content_type_id !== undefined) body.content_type_id = params.content_type_id;
    if (params.status !== undefined) body.status = params.status;
    if (params.channel !== undefined) body.channel = params.channel;
    if (params.assignee_ids !== undefined) body.assignee_ids = params.assignee_ids;
    if (params.due_date !== undefined) body.due_date = params.due_date;
    if (params.publish_date !== undefined) body.publish_date = params.publish_date;
    if (params.priority !== undefined) body.priority = params.priority;
    if (params.tags !== undefined) body.tags = params.tags;
    if (params.project_id !== undefined) body.project_id = params.project_id;
    if (params.custom_fields !== undefined) body.custom_fields = params.custom_fields;

    const result = await api("/items", "POST", body);
    return { content: [{ type: "text" as const, text: formatResponse(result) }] };
  }
);

server.tool(
  "update_item",
  "Update an existing content item. Only provide the fields you want to change.",
  {
    id: z.string().describe("The content item ID to update (UUID)"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    content_type_id: z.string().optional().describe("New content type ID"),
    status: z.string().optional().describe("New board column ID for status"),
    channel: z.string().optional().describe("New channel name"),
    assignee_ids: z.array(z.string()).optional().describe("New assignee user IDs"),
    due_date: z.string().optional().describe("New due date (YYYY-MM-DD)"),
    publish_date: z.string().optional().describe("New publish date (YYYY-MM-DD)"),
    priority: z.string().optional().describe("New priority: low, medium, high, or urgent"),
    tags: z.array(z.string()).optional().describe("New tags array"),
    project_id: z.string().optional().describe("New project ID"),
    custom_fields: z.record(z.string(), z.unknown()).optional().describe("Updated custom field values"),
    archived: z.boolean().optional().describe("Set to true to archive, false to unarchive"),
  },
  async (params) => {
    const { id, ...fields } = params;
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) body[key] = value;
    }

    const result = await api(`/items/${id}`, "PATCH", body);
    return { content: [{ type: "text" as const, text: formatResponse(result) }] };
  }
);

server.tool(
  "delete_item",
  "Permanently delete a content item. This cannot be undone. Requires an API key with 'full' scope.",
  {
    id: z.string().describe("The content item ID to delete (UUID)"),
  },
  async (params) => {
    const result = await api(`/items/${params.id}`, "DELETE");
    return { content: [{ type: "text" as const, text: formatResponse(result) }] };
  }
);

server.tool(
  "list_types",
  "List all content types configured in the workspace (e.g. Blog Post, Social Post, Email). Use the returned IDs when creating or filtering items.",
  {},
  async () => {
    const result = await api("/types");
    return { content: [{ type: "text" as const, text: formatResponse(result) }] };
  }
);

server.tool(
  "list_statuses",
  "List all board column statuses configured in the workspace (e.g. Backlog, Draft, Review, Published). Use the returned IDs when creating or filtering items.",
  {},
  async () => {
    const result = await api("/statuses");
    return { content: [{ type: "text" as const, text: formatResponse(result) }] };
  }
);

// ── Start ───────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
