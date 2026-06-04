import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const LINEAR_API = "https://api.linear.app/graphql";

// ── GraphQL query ───────────────────────────────────────────────────────────

const ISSUES_QUERY = `
  query MyIssues($after: String) {
    viewer {
      assignedIssues(
        first: 50
        after: $after
        filter: {
          state: { type: { nin: ["canceled"] } }
          completedAt: { null: true }
        }
        orderBy: updatedAt
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          identifier
          title
          description
          url
          priority
          priorityLabel
          dueDate
          createdAt
          updatedAt
          state { name type }
          team { id name }
          assignee { name email }
          project { id name }
          labels { nodes { name } }
        }
      }
    }
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  priority: number;
  priorityLabel: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  state: { name: string; type: string };
  team: { id: string; name: string };
  assignee: { name: string; email: string } | null;
  project: { id: string; name: string } | null;
  labels: { nodes: { name: string }[] };
}

async function fetchLinearIssues(apiKey: string): Promise<LinearIssue[]> {
  const allIssues: LinearIssue[] = [];
  let after: string | null = null;

  for (let page = 0; page < 10; page++) {
    const res = await fetch(LINEAR_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: ISSUES_QUERY,
        variables: { after },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Linear API error ${res.status}: ${text}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`Linear GraphQL error: ${json.errors[0]?.message}`);
    }

    const { nodes, pageInfo } = json.data.viewer.assignedIssues;
    allIssues.push(...nodes);

    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  return allIssues;
}

function mapPriority(linearPriority: number): string {
  // Linear: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
  switch (linearPriority) {
    case 1: return "urgent";
    case 2: return "high";
    case 3: return "medium";
    case 4: return "low";
    default: return "medium";
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    // ── Auth: verify JWT before doing any work ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { workspace_id, user_id } = await req.json();
    if (!workspace_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id and user_id required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify the authenticated user matches the requested user_id
    if (authUser.id !== user_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: user_id does not match authenticated user" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Linear credentials from user_integrations (personal integration)
    const { data: integration, error: intError } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user_id)
      .eq("platform", "linear")
      .single();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Linear integration not connected. Connect your Linear API key in Settings." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = integration.access_token;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No Linear API key found" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch issues from Linear
    const issues = await fetchLinearIssues(apiKey);

    // Get existing links to avoid duplicates
    const { data: existingLinks } = await supabase
      .from("linear_issue_links")
      .select("linear_issue_id, content_item_id")
      .in("linear_issue_id", issues.map((i) => i.id));

    const existingMap = new Map(
      (existingLinks ?? []).map((l) => [l.linear_issue_id, l.content_item_id])
    );

    // Get the default board column for new items
    const { data: columns } = await supabase
      .from("board_columns")
      .select("id")
      .eq("workspace_id", workspace_id)
      .order("position", { ascending: true })
      .limit(1);

    const defaultStatus = columns?.[0]?.id ?? null;

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const issue of issues) {
      const existingContentId = existingMap.get(issue.id);

      if (existingContentId) {
        // Fetch the existing item to merge custom_fields
        const { data: existingItem } = await supabase
          .from("content_items")
          .select("custom_fields")
          .eq("id", existingContentId)
          .single();

        const existingCustom = (existingItem?.custom_fields as Record<string, unknown>) ?? {};

        // Update existing content item and link
        await supabase
          .from("content_items")
          .update({
            title: issue.title,
            description: issue.description ?? undefined,
            due_date: issue.dueDate ?? undefined,
            priority: mapPriority(issue.priority),
            custom_fields: {
              ...existingCustom,
              _linear_status: issue.state.name,
              _linear_project: issue.project?.name ?? null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingContentId);

        await supabase
          .from("linear_issue_links")
          .update({
            title: issue.title,
            status: issue.state.name,
            priority_label: issue.priorityLabel,
            assignee_name: issue.assignee?.name ?? null,
            synced_at: new Date().toISOString(),
          })
          .eq("linear_issue_id", issue.id);

        updated++;
      } else {
        // Create new content item
        const tags = [
          "linear",
          ...issue.labels.nodes.map((l) => l.name.toLowerCase()),
        ];

        const { data: newItem, error: itemError } = await supabase
          .from("content_items")
          .insert({
            workspace_id,
            title: issue.title,
            description: issue.description,
            status: defaultStatus,
            due_date: issue.dueDate,
            priority: mapPriority(issue.priority),
            assignee_ids: user_id ? [user_id] : [],
            tags,
            custom_fields: {
              _source: "linear",
              _linear_id: issue.id,
              _linear_identifier: issue.identifier,
              _linear_url: issue.url,
              _linear_team: issue.team.name,
              _linear_project: issue.project?.name ?? null,
              _linear_status: issue.state.name,
            },
          })
          .select("id")
          .single();

        if (itemError) {
          console.error(`Failed to create item for ${issue.identifier}:`, itemError);
          skipped++;
          continue;
        }

        // Create the link
        const { error: linkError } = await supabase
          .from("linear_issue_links")
          .insert({
            content_item_id: newItem.id,
            linear_issue_id: issue.id,
            linear_team_id: issue.team.id,
            linear_team_name: issue.team.name,
            title: issue.title,
            status: issue.state.name,
            priority_label: issue.priorityLabel,
            assignee_name: issue.assignee?.name ?? null,
            url: issue.url,
          });

        if (linkError) {
          console.error(`Failed to create link for ${issue.identifier}:`, linkError);
        }

        created++;
      }
    }

    // Update last synced time on the user integration
    await supabase
      .from("user_integrations")
      .update({
        config: {
          ...(integration.config as Record<string, unknown>),
          last_synced: new Date().toISOString(),
          issues_count: issues.length,
        },
      })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({
        success: true,
        total: issues.length,
        created,
        updated,
        skipped,
      }),
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("sync-linear error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error during Linear sync" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
