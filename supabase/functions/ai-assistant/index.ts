import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AiAction = "summarize" | "headlines" | "meta_description" | "social_posts" | "improvements" | "custom";

function buildPrompt(action: AiAction, item: { title: string; description: string; content_type?: string; channel?: string }, customPrompt?: string): string {
  const context = `Title: ${item.title}\nContent Type: ${item.content_type || "General"}\nChannel: ${item.channel || "Not specified"}\nDescription:\n${item.description || "(no description yet)"}`;

  switch (action) {
    case "summarize":
      return `You are a content strategist. Summarize the following content item in 2-3 sentences, capturing the core message and purpose.\n\n${context}\n\nSummary:`;

    case "headlines":
      return `You are a copywriter. Generate 5 compelling headline options for the following content item. Each headline should be on a new line, numbered 1-5. Make them punchy, clear, and optimized for the specified channel.\n\n${context}\n\nHeadlines:`;

    case "meta_description":
      return `You are an SEO specialist. Write a compelling meta description (150-160 characters) for the following content item. It should be informative, include a subtle call to action, and accurately represent the content.\n\n${context}\n\nMeta description:`;

    case "social_posts":
      return `You are a social media manager. Create 3 social post variants for the following content item:\n1. Twitter/X (max 280 chars, punchy)\n2. LinkedIn (professional, 2-3 sentences)\n3. Instagram caption (engaging, with relevant hashtags)\n\nSeparate each with "---"\n\n${context}\n\nSocial posts:`;

    case "improvements":
      return `You are a content editor. Review the following content item description and suggest 3-5 specific, actionable improvements. Focus on clarity, structure, and impact. Format as a numbered list.\n\n${context}\n\nSuggested improvements:`;

    case "custom":
      return `You are a helpful content assistant. The user is working on the following content item:\n\n${context}\n\nUser request: ${customPrompt || "Help me with this content."}`;

    default:
      return `${context}\n\n${customPrompt || "How can I improve this content?"}`;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      workspace_id: string;
      content_item_id: string;
      action: AiAction;
      item: { title: string; description: string; content_type?: string; channel?: string };
      custom_prompt?: string;
    };

    const { workspace_id, content_item_id, action, item, custom_prompt } = body;

    // Fetch the Claude API key from the workspace's claude integration
    const { data: integration } = await supabaseClient
      .from("integrations")
      .select("config, status")
      .eq("workspace_id", workspace_id)
      .eq("platform", "claude")
      .maybeSingle();

    if (!integration || integration.status !== "connected") {
      return new Response(JSON.stringify({ error: "Claude integration not connected. Add your API key in Settings → Integrations." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = (integration.config as Record<string, string>)?.api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Claude API key not configured." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(action, item, custom_prompt);

    // Call Claude API
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      return new Response(JSON.stringify({ error: `Claude API error: ${claudeRes.status} ${errBody}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeRes.json();
    const responseText = claudeData.content?.[0]?.text ?? "";

    // Store in ai_interactions
    await supabaseClient.from("ai_interactions").insert({
      content_item_id,
      workspace_id,
      user_id: user.id,
      action,
      prompt,
      response: responseText,
    });

    return new Response(
      JSON.stringify({ response: responseText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
