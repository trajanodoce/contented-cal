import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLATFORM_PATTERNS: Record<string, RegExp> = {
  ordinal: /app\.tryordinal\.com/i,
  figma: /figma\.com/i,
  canva: /canva\.com/i,
  miro: /miro\.com/i,
  google_docs: /docs\.google\.com/i,
  google_drive: /drive\.google\.com/i,
  notion: /notion\.so|notion\.site/i,
  linear: /linear\.app/i,
};

function detectPlatform(url: string): string {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) return platform;
  }
  return "other";
}

async function fetchFigmaMetadata(url: string): Promise<{ title: string; thumbnail_url: string; description: string }> {
  try {
    const oembedUrl = `https://www.figma.com/api/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title ?? "",
        thumbnail_url: data.thumbnail_url ?? "",
        description: data.author_name ? `By ${data.author_name}` : "",
      };
    }
  } catch {}
  return { title: "", thumbnail_url: "", description: "" };
}

async function fetchOpenGraph(url: string): Promise<{ title: string; thumbnail_url: string; description: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentCalBot/1.0; +https://contentcal.app)",
        "Accept": "text/html",
      },
    });
    if (!res.ok) return { title: "", thumbnail_url: "", description: "" };

    const html = await res.text();

    function getMeta(property: string): string {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
        new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
      ];
      for (const pattern of patterns) {
        const m = html.match(pattern);
        if (m) return m[1];
      }
      return "";
    }

    function getTitle(): string {
      const og = getMeta("og:title") || getMeta("twitter:title");
      if (og) return og;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return titleMatch ? titleMatch[1].trim() : "";
    }

    return {
      title: getTitle(),
      thumbnail_url: getMeta("og:image") || getMeta("twitter:image"),
      description: getMeta("og:description") || getMeta("twitter:description") || getMeta("description"),
    };
  } catch {
    return { title: "", thumbnail_url: "", description: "" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth: require a valid Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json() as { url: string };

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: "Only HTTP/HTTPS URLs are supported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platform = detectPlatform(url);
    let meta = { title: "", thumbnail_url: "", description: "" };

    if (platform === "figma") {
      meta = await fetchFigmaMetadata(url);
      if (!meta.title) meta = await fetchOpenGraph(url);
    } else {
      meta = await fetchOpenGraph(url);
    }

    // Fallback title: use hostname + path
    if (!meta.title) {
      meta.title = `${parsedUrl.hostname}${parsedUrl.pathname !== "/" ? parsedUrl.pathname : ""}`;
    }

    return new Response(
      JSON.stringify({ platform, ...meta }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
