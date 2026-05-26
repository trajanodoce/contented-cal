import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// ── Voice profiles (condensed from bolter-tones) ─────────────────────────────

const VOICE_PROFILES: Record<string, string> = {
  "Eric Simons": `Voice: Eric Simons — Builder-CEO energy.
Core traits: Casually confident, technically fluent, hype without polish. Writes like texting a group chat of engineers. Short sentences. Fragments. Lowercase energy.
Sentence patterns: Short declarative openers. One-line follow-ups that reframe or escalate. Occasional parenthetical. Dashes for lists. Em dashes and line breaks for rhythm.
Avoids: Corporate/PR language, long threads, hedging, hashtags, self-congratulatory tone — the team wins.
Emoji: Sparse and purposeful. Lightning bolt for Bolt. Blue heart for community.
Voice in 5 words: Casual. Concrete. Generous. Technical. Hyped.`,

  "Alexander Berger": `Voice: Alexander Berger — Operator-commentator energy.
Core traits: Internet-native casual. Uses shorthand ("ppl," "u"), meme formats, quote-tweets as primary mode. Commentary over announcements — he reacts, not broadcasts. Humor-first: memes, reaction videos, dry one-liners. Broad topics (politics, culture, personal). Opinionated but measured.
Sentence patterns: Very short one-liners, often a single fragment. Quote-tweet + reaction format. Two-part: observation + punchline. Colons to set up reveals.
Avoids: Long threads, formal launch language, over-explained context, hashtags, corporate voice, taking himself too seriously.
Emoji: More liberal than Eric but purposeful. Muscle for wins, prayer hands, laughing emoji.
Voice in 5 words: Memetic. Reactive. Blunt. Playful. Grounded.`,

  "Dominic Elm": `Voice: Dominic Elm — Engineer-educator energy.
Core traits: Teacher-builder first, promoter second. Default mode is explaining how things work. Curiosity as hook — opens with questions ("Ever wondered how...?"). Grounded technical authority — names specific technologies without hedging. Measured enthusiasm — earns his exclamation points. Problem-framer, not opinion-warrior.
Sentence patterns: Curiosity hook openers. Temporal/milestone leads. Dramatic pause with ellipsis. Direct thesis statements. Closes with community questions.
Avoids: Hot takes, dunking, internet slang, memes, self-deprecation, empty superlatives, personal lifestyle content.
Emoji: Moderate and purposeful. Structural markers more than emotional signals.
Voice in 5 words: Methodical. Substantive. Curious. Grounded. Earned.`,

  "Garrett Serviss": `Voice: Garrett Serviss — Marketing-operator energy.
Core traits: Structured and deliberate. Writes in complete, well-formed sentences. Hook-first marketer's instinct — strong declarative opens. Benefit-led product framing. People and leadership lens. Practical value-sharer — teaches by showing his own work.
Sentence patterns: Strong declarative hook. Problem statement → solution framing. Lists for features/steps. Closing CTA. Clean paragraph breaks.
Avoids: Memes, reaction videos, political hot takes, sentence fragments, overly technical jargon, self-deprecation, hashtags.
Emoji: Minimal and professional. Occasional emphasis.
Voice in 5 words: Structured. Benefit-led. Warm. Polished. Practical.`,

  "Donald Savard": `Voice: Donald Savard — Launch-mode PMM energy.
Core traits: Ultra-compact bursts — 1-2 sentences max. Vibes-first product marketing — aesthetic and emotional reactions. Always-on launch energy. Show-don't-tell demo style. Conversational community builder — polls, questions, honest takes. Meme-literate. Aspirational micro-content.
Sentence patterns: Ultra-short declarative. Screenshot/video does the heavy lifting. Drawn-out words for emphasis ("whiiiiiile"). Prompt-result pairs.
Avoids: Long threads, technical deep-dives, formal marketing language, structured posts with headers, hashtags, corporate hedging.
Emoji: Moderate and celebratory. Raised hands for wins.
Voice in 5 words: Punchy. Vibes-driven. Prolific. Showcase-first. Conversational.`,

  "Gary Ballabio": `Voice: Gary Ballabio — Enterprise partnerships energy.
Core traits: Amplifier above all — ~85-90% reposts. When original, reads like BD announcements. Multi-paragraph, structured, benefit-oriented. Enterprise and partnership framing. Only Bolt voice who uses hashtags. Celebratory emoji style. Occasional ultra-short reactions with trailing dots.
Sentence patterns: Multi-paragraph structured announcement. Hashtag-enriched first line. Celebratory emoji as punctuation. Trailing ellipsis for short reactions. CTA-driven closers.
Avoids: Memes, technical deep-dives, sentence fragments, personal hot takes, irony, stream-of-consciousness.
Emoji: Moderate, always celebratory/professional. Party popper, flexed bicep.
Voice in 5 words: Professional. Amplifying. Partnership-focused. Polished. Hashtag-forward.`,
};

// ── Persona briefs (condensed from bolt-buyer-personas) ──────────────────────

const PERSONA_BRIEFS: Record<string, string> = {
  "Small business owner / founder": `Persona: Small business owner / founder / entrepreneur.
Non-technical domain experts. Open to AI but don't know where to start. Zero patience for fluff.
Voice: Plain language, relatable scenarios, ROI-focused, low jargon.
Pain points: Website costs ($8K-$22K quotes), time, loss of control, AI knowledge gap, tool overwhelm.
What works: Cost comparison ($20/month vs $12K upfront), speed (afternoon vs months), control, real examples from people like them.
Reading level: Flesch 60-70, short sentences, minimal jargon.`,

  "Enterprise CTO / App Dev Leader": `Persona: Enterprise CTO / App Dev Leader.
Technical gatekeeper, owns the stack and security posture. High jargon tolerance.
Voice: Authoritative, infrastructure-focused, architecture and scale matter.
Pain points: Security, compliance, performance at scale, legacy migration, team productivity.
What works: Technical depth, architecture details, security certifications, performance benchmarks.
Reading level: Flesch 40-55, technical precision, show don't tell.`,

  "Enterprise CPO": `Persona: Enterprise CPO.
Product and innovation leader, owns velocity and team productivity.
Voice: Authoritative, outcome-focused, business outcomes and competitive positioning.
Pain points: Time to market, team velocity, competitive pressure, innovation pipeline.
What works: Business outcomes, product strategy, competitive positioning, case studies.
Reading level: Flesch 50-60, balanced jargon, features-to-outcomes framing.`,

  "Product manager": `Persona: Product manager.
Bridge between business and engineering, needs speed to validation.
Voice: Practical, PRD-fluent, workflow improvements, features-to-outcomes framing.
Pain points: Slow prototyping cycles, dependency on engineering, validating ideas quickly.
What works: Speed-to-prototype, reducing dependencies, workflow improvements, before/after.
Reading level: Flesch 50-65, moderate jargon, concrete examples.`,

  "Professional developer": `Persona: Professional developer.
AI power user, skeptical of AI-coded output. High jargon tolerance, technical precision required.
Voice: Technical, direct, humor welcome, show don't tell.
Pain points: Code quality concerns, debugging AI output, workflow disruption.
What works: Technical precision, code examples, honest limitations, respect for craft.
Reading level: Flesch 35-50, high jargon density OK, demonstrate rather than claim.`,

  "Marketer / creative / freelancer": `Persona: Marketer / creative / freelancer.
Design-fluent builders who deliver for clients or campaigns.
Voice: Confident, visual, outcome-driven, benefits and speed.
Pain points: Client delivery deadlines, design-to-code gap, cost of specialized tools.
What works: Visual results, speed, low technical barrier, client-facing output quality.
Reading level: Flesch 55-65, moderate jargon, visual-first framing.`,

  "General reader": `Persona: General reader.
Curious explorer, top-of-funnel, not buying yet.
Voice: Accessible, educational, broad appeal, minimal assumptions.
Pain points: Curiosity about AI, information overload, not sure what's possible.
What works: Plain language, surprising examples, low barrier, inspiration over instruction.
Reading level: Flesch 65-75, minimal jargon, educational tone.`,
};

// ── Banned phrases (condensed from bolt-TOV-and-guidelines) ──────────────────

const BANNED_PHRASES = `BANNED PHRASES — Remove every instance:
Throat-clearing: "Here's the thing:", "Here's what/why/this...", "The uncomfortable truth is", "It turns out", "Let me be clear", "The truth is", "Can we talk about"
Emphasis crutches: "Full stop.", "Let that sink in.", "Read that again.", "This matters because", "This changes everything"
Dead AI language: "In today's...", "It's worth noting...", "Delve", "Dive into", "Landscape", "Realm", "Robust", "Game-changer", "Cutting-edge", "In order to", "In a world where", "When it comes to", "At the end of the day", "At its core"
Dead transitions: "Furthermore", "Additionally", "Moreover", "Moving forward", "To put this in perspective...", "In other words..."
AI cringe: "Supercharge", "Unlock", "Future-proof", "10x your productivity", "The AI revolution"
Generic insider: "Here's the part nobody's talking about", "What nobody tells you"
Business jargon: "Navigate (challenges)", "Lean into", "Double down", "Deep dive", "Circle back"
Meta-commentary: "Hint:", "Plot twist:", "Let me walk you through...", "In this section, we'll..."
Adverbs: Kill all -ly words. No softeners (really, just, simply), intensifiers (genuinely, truly, deeply), or hedges (honestly, actually, fundamentally).`;

// ── Structures to avoid (condensed) ──────────────────────────────────────────

const STRUCTURES_TO_AVOID = `STRUCTURES TO AVOID:
Binary contrasts: "Not because X. Because Y." / "X isn't the problem. Y is." — State Y directly.
Dramatic fragmentation: "[Noun]. That's it." / "X. And Y. And Z." — Complete sentences.
Rhetorical setups: "What if I told you..." / "Here's what I mean:" — Make the point directly.
False agency: "a complaint becomes a fix" — Name the human who fixed it.
Narrator-from-distance: "People tend to..." — Use "you" instead.
Overly smooth connectors: "This belief defines..." — Cut if the paragraph follows logically.
Rhythm issues: Default to pairs (not tricolons). Vary sentence lengths. No stacked punchy fragments. Vary paragraph endings.`;

// ── Schwartz matrix (condensed for diagnosis action) ─────────────────────────

const SCHWARTZ_MATRIX = `SCHWARTZ 5x5 FRAMEWORK:

Two axes determine your copy approach:
1. Customer Awareness: How much does the reader know? (Unaware → Problem-aware → Solution-aware → Product-aware → Most aware)
2. Market Sophistication: How many competitors made similar promises? (Stage 1: First to market → Stage 5: Total skepticism)

AWARENESS LEVELS:
- Unaware: Lead with story/identity, not the product. Long copy. Build the entire journey.
- Problem-aware: Name the pain vividly. Show you understand better than they do. Medium-long copy.
- Solution-aware: Show your mechanism is different. Unique approach matters most here. Medium copy.
- Product-aware: Proof, comparison, social validation. Stack evidence. Medium-short copy.
- Most aware: Just make the offer, remove friction. Short copy. Deal-driven.

SOPHISTICATION LEVELS:
- Stage 1 (First to market): Simple direct claim. State the benefit. Short headlines.
- Stage 2 (Competing claims): Enlarge the claim. Bigger, faster, more specific.
- Stage 3 (Mechanism era): Explain HOW it works differently. Unique mechanism wins.
- Stage 4 (Proof required): Stack evidence. Testimonials, numbers, before/after.
- Stage 5 (Total skepticism): Lead with identity or story. Proof through narrative.

KEY INTERSECTIONS:
- Unaware + Stage 1: Story → problem recognition → solution → product → CTA
- Problem-aware + Stage 3: Agitate pain → introduce your mechanism → show how → proof → CTA
- Solution-aware + Stage 4: Lead with proof your mechanism delivers → comparison → stacked evidence
- Product-aware + Stage 5: Social proof + identity → "people like you chose this" → offer
- Most aware + any stage: Remove friction. Offer + urgency. Shortest possible copy.

For each content piece, diagnose: What should the headline strategy be? Should the lead be story, problem, mechanism, proof, or offer? What copy length? What proof type?`;

// ── Core system prompt ───────────────────────────────────────────────────────

const CORE_SYSTEM_PROMPT = `You are the Bolt.new Writer — a content creation assistant for the Bolt.new content team.

VOICE AND TONE:
- Default voice: Bolt.new TOV — direct, casual-confident, technically honest. Say what you mean. No corporate padding.
- If a specific voice is selected on this content item, adapt: match that person's rhythm, energy, and vocabulary while keeping Bolt.new editorial standards.
- No filler words, hedge phrases, or empty transitions. Every sentence earns its place.
- Sentence casing for headings (not Title Case).
- Always refer to the product as Bolt.new. Never just "Bolt."
- Use the Oxford comma.
- Active voice. Contractions. US spelling.
- Limit adverbs and adjectives. Cut redundant modifiers.

CONTENT TYPE AWARENESS:
Adapt your approach to the content type:
- Blog: Hook opening, H2/H3 structure, 800-1500 words, CTA at end
- Social: Platform-native voice. LinkedIn: professional with humor, ~250-1300 chars. X: brevity-first, ~250 chars.
- Email: Subject line + body, one CTA per email, no clickbait subjects
- Website copy: 5-question test (What is this? Who is it for? Why care? Why trust? What next?). CTA describes what happens when clicked.
- Customer story: Lead with achievement, customer voice carries the story, every claim needs a number or quote
- Ad copy: Produce 3 variants (TOV, Ogilvy, Schwartz). Respect character limits.

PERSONA AWARENESS:
If a target persona is set, shape the content for that reader's language, depth, and pain points.

STOP SLOP RULES:
${BANNED_PHRASES}

${STRUCTURES_TO_AVOID}

When generating content, specify what you produced and offer to iterate.`;

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

  const voice = body.custom_field_context?.voice;
  if (voice && voice !== "Bolt.new TOV" && VOICE_PROFILES[voice]) {
    parts.push(`\n--- ACTIVE VOICE PROFILE ---\n${VOICE_PROFILES[voice]}`);
  }

  const persona = body.custom_field_context?.target_persona;
  if (persona) {
    // Try exact match first, then partial
    const key = Object.keys(PERSONA_BRIEFS).find(
      (k) => k === persona || persona.startsWith(k) || k.startsWith(persona)
    );
    if (key) {
      parts.push(`\n--- ACTIVE PERSONA ---\n${PERSONA_BRIEFS[key]}`);
    }
  }

  // Inject Schwartz matrix for diagnosis action
  if (body.action === "schwartz_diagnosis") {
    parts.push(`\n--- SCHWARTZ FRAMEWORK ---\n${SCHWARTZ_MATRIX}`);
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
        max_tokens: 2048,
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
