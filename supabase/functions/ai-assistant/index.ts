import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  TOV_GUIDE,
  BANNED_PHRASES,
  STRUCTURES_TO_AVOID,
  SCHWARTZ_MATRIX,
  PERSONA_LIBRARY,
  VOICE_PROFILES,
} from "./skill-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Action type ──────────────────────────────────────────────────────────────

type AiAction =
  | "quick_draft"
  | "full_workflow"
  | "headlines"
  | "social_posts"
  | "schwartz_diagnosis"
  | "stop_slop_audit"
  | "improvements"
  | "meta_description"
  | "custom";

// ── Skill content imported from ./skill-content.ts ───────────────────────────
//
// The constants TOV_GUIDE, BANNED_PHRASES, STRUCTURES_TO_AVOID, SCHWARTZ_MATRIX,
// PERSONA_LIBRARY, and VOICE_PROFILES are imported at the top of this file.
// They're auto-generated from ~/Documents/skills/bolt-writing-skills via
// scripts/sync-writing-skill.mjs. Run that script and redeploy when Taylor
// updates any source skill file.
//
// PERSONA_LIBRARY is a single string containing all six persona profiles
// (~30KB). We parse out the relevant section per request so we don't blow the
// system-prompt budget shipping all six every call.

// ── Persona library parser ───────────────────────────────────────────────────

// Map common UI persona labels to the heading anchors used in the library file.
const PERSONA_HEADING_BY_LABEL: Record<string, string> = {
  "Small business owner / founder": "Persona 1: Small business owner",
  "Small business owner / founder / entrepreneur": "Persona 1: Small business owner",
  "Enterprise CTO / App Dev Leader": "Persona 2a: CTO",
  "Enterprise CPO": "Persona 2b: CPO",
  "Enterprise buyer: CTO / App Dev Leader": "Persona 2a: CTO",
  "Enterprise buyer: CPO": "Persona 2b: CPO",
  "Product manager": "Persona 3: Product manager",
  "Professional developer": "Persona 4: Professional developer",
  "Marketer / creative / freelancer": "Persona 5: Marketer / creative",
  "Marketer / creative agency / creative freelancer": "Persona 5: Marketer / creative",
  "General reader": "Persona 6: General reader",
};

/**
 * Pull the matching `## Persona N: ...` block out of the persona library so we
 * inject only the relevant audience into the system prompt. Returns null if no
 * section matches (caller skips persona injection).
 */
function getPersonaSection(label: string | undefined): string | null {
  if (!label) return null;

  // Prefer the explicit alias table; fall back to a fuzzy prefix match.
  const anchor =
    PERSONA_HEADING_BY_LABEL[label] ??
    Object.entries(PERSONA_HEADING_BY_LABEL).find(([key]) =>
      label.toLowerCase().startsWith(key.toLowerCase()),
    )?.[1];

  if (!anchor) return null;

  const startMarker = `## ${anchor}`;
  const startIdx = PERSONA_LIBRARY.indexOf(startMarker);
  if (startIdx < 0) return null;

  // Find the next top-level `## Persona ` heading OR `## Persona selection` so we
  // stop cleanly at the boundary. Use a small offset so we don't match our own start.
  const tail = PERSONA_LIBRARY.slice(startIdx + 1);
  const nextHeadingMatch = tail.match(/\n## (Persona |Persona selection|Data sources)/);
  const endIdx = nextHeadingMatch
    ? startIdx + 1 + (nextHeadingMatch.index ?? tail.length)
    : PERSONA_LIBRARY.length;

  return PERSONA_LIBRARY.slice(startIdx, endIdx).trim();
}

// ── Core system prompt ───────────────────────────────────────────────────────
//
// The system prompt assembles in layers:
//   1. CORE_INTRO — short framing of role + how the layers fit
//   2. TOV_GUIDE — full bolt-TOV-and-guidelines (tone, editorial rules, Stop Slop)
//   3. STOP_SLOP_DETAIL — full banned-phrase catalog + structures-to-avoid
//   4. (selective) ACTIVE VOICE PROFILE — only the one selected on the item
//   5. (selective) ACTIVE PERSONA — only the one selected on the item
//   6. (action-conditional) SCHWARTZ_MATRIX — only for schwartz_diagnosis
//
// Total per-request system prompt: ~10-15K tokens depending on selections.

const CORE_INTRO = `You are the Bolt.new Writer — the AI assistant inside ContentedCal that the Bolt.new content team uses to draft, edit, and audit content.

Three guides shape every response:

1. \`bolt-TOV-and-guidelines\` (below) — the authoritative tone-of-voice, editorial rules, and Stop Slop filter that every Bolt.new and StackBlitz piece must follow.
2. (Optional) \`bolter-tones\` — a specific Bolt team member's voice profile, injected below when one is selected on the content item.
3. (Optional) \`bolt-buyer-personas\` — the target audience's persona profile, injected below when one is set on the content item.

When responding:
- Apply the TOV + Stop Slop filter to every word you produce.
- If a voice profile is active, adapt rhythm, energy, and vocabulary to it while keeping Bolt.new editorial standards.
- If a persona is active, shape angle, depth, vocabulary, examples, and CTA for that reader.
- Match the content type signaled by the request (blog, social, email, ad, etc.).
- Specify what you produced and offer to iterate.`;

const CORE_SYSTEM_PROMPT = `${CORE_INTRO}

═══════════════════════════════════════════════════════════════════════════════
BOLT TOV AND EDITORIAL GUIDELINES (\`bolt-TOV-and-guidelines/SKILL.md\`)
═══════════════════════════════════════════════════════════════════════════════

${TOV_GUIDE}

═══════════════════════════════════════════════════════════════════════════════
BANNED PHRASES (\`bolt-TOV-and-guidelines/references/banned.md\`)
═══════════════════════════════════════════════════════════════════════════════

${BANNED_PHRASES}

═══════════════════════════════════════════════════════════════════════════════
STRUCTURES TO AVOID (\`bolt-TOV-and-guidelines/references/structures.md\`)
═══════════════════════════════════════════════════════════════════════════════

${STRUCTURES_TO_AVOID}`;

// ── Request body type ────────────────────────────────────────────────────────

interface RequestBody {
  workspace_id: string;
  content_item_id: string;
  action: AiAction;
  item: {
    title: string;
    description: string;
    content_type?: string;
    channel?: string;
    priority?: string;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
  };
  custom_field_context?: {
    target_persona?: string;
    buyer_stage?: string;
    voice?: string;
    awareness_level?: string;
    market_sophistication?: string;
  };
  custom_prompt?: string;
}

// ── Build context from item fields ───────────────────────────────────────────

function buildItemContext(body: RequestBody): string {
  const { item, custom_field_context } = body;
  const lines: string[] = [
    `Content Type: ${item.content_type || "Not set"}`,
    `Title: ${item.title}`,
  ];

  if (item.priority) lines.push(`Priority: ${item.priority}`);
  if (item.channel) lines.push(`Channel: ${item.channel}`);
  if (item.tags?.length) lines.push(`Tags: ${item.tags.join(", ")}`);

  if (custom_field_context) {
    const cf = custom_field_context;
    if (cf.target_persona) lines.push(`Target Persona: ${cf.target_persona}`);
    if (cf.buyer_stage) lines.push(`Buyer Stage: ${cf.buyer_stage}`);
    if (cf.voice) lines.push(`Voice: ${cf.voice}`);
    if (cf.awareness_level) lines.push(`Awareness Level: ${cf.awareness_level}`);
    if (cf.market_sophistication) lines.push(`Market Sophistication: ${cf.market_sophistication}`);
  }

  if (item.description) {
    lines.push(`\nDescription / Current Draft:\n${item.description}`);
  } else {
    lines.push("\nDescription: (no description yet)");
  }

  return lines.join("\n");
}

// ── Build system prompt with dynamic injections ──────────────────────────────

function buildSystemPrompt(body: RequestBody): string {
  const parts: string[] = [CORE_SYSTEM_PROMPT];

  // Inject the active voice profile if one is selected and we have a match.
  const voice = body.custom_field_context?.voice;
  if (voice && voice !== "Bolt.new TOV" && VOICE_PROFILES[voice]) {
    parts.push(
      `\n═══════════════════════════════════════════════════════════════════════════════\n` +
      `ACTIVE VOICE PROFILE — ${voice} (\`bolter-tones/references/...\`)\n` +
      `═══════════════════════════════════════════════════════════════════════════════\n\n` +
      `Apply this voice on top of the Bolt.new editorial guidelines. The TOV + Stop Slop ` +
      `rules above still govern grammar, formatting, and quality. The voice profile shapes ` +
      `rhythm, energy, sentence patterns, and vocabulary.\n\n` +
      `${VOICE_PROFILES[voice]}`,
    );
  }

  // Inject the active persona section if one is selected and we can resolve it.
  const persona = body.custom_field_context?.target_persona;
  const personaSection = getPersonaSection(persona);
  if (personaSection) {
    parts.push(
      `\n═══════════════════════════════════════════════════════════════════════════════\n` +
      `ACTIVE PERSONA — ${persona} (\`bolt-buyer-personas/SKILL.md\`)\n` +
      `═══════════════════════════════════════════════════════════════════════════════\n\n` +
      `Shape every decision — angle, depth, vocabulary, examples, CTA — for this audience. ` +
      `Apply the Voice adjustment + Readability targets on top of the Bolt.new TOV.\n\n` +
      `${personaSection}`,
    );
  }

  // Schwartz matrix is only relevant to the schwartz_diagnosis action.
  if (body.action === "schwartz_diagnosis") {
    parts.push(
      `\n═══════════════════════════════════════════════════════════════════════════════\n` +
      `SCHWARTZ 5x5 MATRIX (\`writing-bolt-ed-ly/references/schwartz-5x5-matrix.md\`)\n` +
      `═══════════════════════════════════════════════════════════════════════════════\n\n` +
      `${SCHWARTZ_MATRIX}`,
    );
  }

  return parts.join("\n");
}

// ── Build user message per action ────────────────────────────────────────────

function buildUserMessage(body: RequestBody): string {
  const ctx = buildItemContext(body);
  const contentType = body.item.content_type || "content";
  const voice = body.custom_field_context?.voice;
  const voiceNote = voice && voice !== "Bolt.new TOV"
    ? ` Match the ${voice} voice profile.`
    : "";

  switch (body.action) {
    case "quick_draft":
      return `Write a quick draft of this ${contentType}. Use the description, persona, and voice settings from this item. Keep it tight — no outline step, just draft and deliver.${voiceNote}\n\n${ctx}`;

    case "full_workflow":
      return `Generate a structured outline for this ${contentType}. Include: working title (sentence casing), hook/opening angle, section breakdown with H2/H3 headers and one-line summaries, key details to include, and CTA. I'll review and approve before you draft.\n\n${ctx}`;

    case "headlines":
      return `Generate 5 headline options for this ${contentType}. Use the target persona and awareness level to shape the approach. Sentence casing. No clickbait. Number each 1-5.\n\n${ctx}`;

    case "social_posts":
      return `Generate social post variants from this content:\n1. LinkedIn post (~800 chars, professional with personality)\n2. X post (~250 chars, brevity-first)\n3. Short-form teaser (1-2 sentences for promos)${voiceNote}\n\nSeparate each with "---"\n\n${ctx}`;

    case "schwartz_diagnosis":
      return `Diagnose this content's Schwartz positioning. Based on the target persona, awareness level, and market sophistication, recommend:\n- What should the headline strategy be?\n- Should the lead be story, problem, mechanism, proof, or offer?\n- What copy length is right?\n- What proof type works best?\n\nBe specific to this content — not generic advice.\n\n${ctx}`;

    case "stop_slop_audit":
      return `Audit this description for slop. Score on 5 dimensions (directness, rhythm, trust, authenticity, density) out of 10 each. Flag every violation with the specific line. Suggest specific rewrites for each flagged line. 35/50 minimum to pass.\n\n${ctx}`;

    case "improvements":
      return `Review this description and suggest specific edits for clarity, engagement, and SEO. Be direct — show the before and after for each suggestion. Number each suggestion.\n\n${ctx}`;

    case "meta_description":
      return `Write an SEO meta description for this content. Under 160 characters. Include the core value prop and a reason to click. No clickbait. Show the character count.\n\n${ctx}`;

    case "custom":
      return `${body.custom_prompt || "Help me with this content."}\n\n${ctx}`;

    default:
      return `${body.custom_prompt || "How can I improve this content?"}\n\n${ctx}`;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as RequestBody;
    const { workspace_id, content_item_id, action } = body;

    // Resolve API key: DB integration → env var fallback
    let apiKey = "";

    const { data: integration } = await supabaseClient
      .from("integrations")
      .select("access_token, config, status")
      .eq("workspace_id", workspace_id)
      .eq("platform", "claude")
      .maybeSingle();

    if (integration?.status === "connected") {
      apiKey =
        integration.access_token ||
        (integration.config as Record<string, string>)?.api_key ||
        "";
    }

    // Fall back to server-side env var if no DB key
    if (!apiKey) {
      apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Claude API key not configured. Add your key in Settings → Integrations, or ask an admin to set the ANTHROPIC_API_KEY secret.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(body);
    const userMessage = buildUserMessage(body);

    // Call Claude API
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        // 4096 leaves room for long-form drafts (blog, customer story, long-form)
        // without truncating. Costs more on per-call tokens but the writing skill
        // routinely needs the headroom.
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      const status = claudeRes.status;
      let friendlyMsg = `Claude API error (${status})`;
      if (status === 401) friendlyMsg = "Invalid API key. Check your Anthropic API key in Settings → Integrations.";
      else if (status === 429) friendlyMsg = "Rate limit exceeded. Wait a moment and try again.";
      else if (status === 529) friendlyMsg = "Claude is temporarily overloaded. Try again in a few seconds.";

      return new Response(
        JSON.stringify({ error: friendlyMsg, details: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeRes.json();
    const responseText = claudeData.content?.[0]?.text ?? "";

    // Store in ai_interactions
    await supabaseClient.from("ai_interactions").insert({
      content_item_id,
      user_id: user.id,
      action,
      prompt: userMessage.slice(0, 2000), // Truncate for storage
      response: responseText,
    });

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
