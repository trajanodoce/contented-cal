# SEO/GEO Toolkit

Skills and data integrations available during the content workflow. Organized by phase with conditional triggers that fire automatically based on content type, user input, and workflow state.

---

## Automatic triggers

These run without asking when the conditions are met. Skip the trigger if the user has already provided the data it would fetch (e.g., they handed you keywords, so skip keyword research).

### During research (Step 2)

| Condition | Action |
|-----------|--------|
| Content type is blog, long-form, or website copy AND the user hasn't provided target keywords | Run `/keyword-research` for the topic. Use results to inform the outline. |
| Content type is blog or long-form AND this is a Content Bonanza workflow | Run `/serp-analysis` on the primary keyword to understand what Google rewards for this query (format, depth, features, AI Overviews). |
| The user mentions a competitor by name or asks to differentiate | Run `/competitor-analysis` on the named competitor. |
| Content type is blog and the piece is part of a content series or hub | Run `/seo-cluster` to validate the topic cluster structure and internal link plan. |

### During drafting (Step 4)

| Condition | Action |
|-----------|--------|
| Content type is blog, long-form, or website copy | Apply GEO/AEO rules from `references/geo-aeo-signals-and-blog-best-practices.md` during drafting. This is a drafting rule, not a post-draft skill. |
| Content type is ad copy | Run the Schwartz diagnosis from `references/schwartz-5x5-matrix.md` to determine headline and lead strategy. This feeds the three-variant output. |

### After drafting (Step 5-6)

| Condition | Action |
|-----------|--------|
| Content will be published on bolt.new (blog, landing page, or website copy) | Generate meta title + meta description. Offer to run `/meta-tags-optimizer` if the user wants alternatives. |
| Content includes FAQ or how-to sections | Offer to run `/schema-markup-generator` for FAQ, Article, or HowTo JSON-LD. |
| Content is a blog that references other Bolt.new content | Run `/internal-linking-optimizer` to validate link structure and anchor text. |
| GEO priority is flagged as high (user stated it, or the topic targets question/definition/comparison queries) | Run `/geo-content-optimizer` after the stop-slop audit. Check passage-level extractability, quotable statements, and citation signals. |

---

## Offer-based triggers

These don't run automatically. Present them as options (using AskUserQuestion with `multiSelect: true`) at the relevant workflow stage. Only surface options that match the content type and context. Don't dump the full list.

### After outline approval (before drafting)

Offer if the user wants deeper research before committing to the draft:

| Skill | When to offer | What it does |
|-------|--------------|-------------|
| `/seo-content-brief` | User wants a competitive brief with target word count, keyword density, and heading structure | Generates a data-backed content brief from SERP analysis |
| `/content-gap-analysis` | User isn't sure what angle to take, or wants to find gaps competitors miss | Surfaces topics, formats, and angles competitors cover that Bolt.new doesn't |
| `/content-strategy` | The piece is part of a larger campaign or pillar and the user wants to validate the broader plan | Content planning: pillars, clusters, prioritization framework |
| `/seo-plan` | User asks for a full SEO roadmap (rare during single-piece creation) | Strategic SEO plan with keyword priorities, content calendar, and technical recommendations |

### After presenting the draft (Step 6)

Offer based on what the user asks for or where the draft could improve:

| Skill | When to offer | What it does |
|-------|--------------|-------------|
| `/content-quality-auditor` | User wants a quality score or publish-readiness check | 80-item CORE-EEAT audit with actionable fixes |
| `/on-page-seo-auditor` | User wants a technical on-page review (titles, headers, images, links) | On-page SEO audit against the target keyword |
| `/seo-images` | Content includes images or the user asks about image optimization | Alt text, file size, format, and placement recommendations |
| `/seo-image-gen` | Content needs OG images, hero images, or visual assets | Image generation plan with prompts (does not auto-generate) |
| `/entity-optimizer` | User wants to strengthen brand/author recognition in AI systems | Knowledge Graph and entity signal recommendations |
| `/socialize-content` | User wants to repurpose the piece into social posts | Generates LinkedIn, X, or Reddit versions from the draft |

### After publish

Offer when the user shares a live URL or asks about performance:

| Skill | When to offer | What it does |
|-------|--------------|-------------|
| `/seo-audit` | User shares a live URL and wants a full audit | Comprehensive page audit covering technical, content, and link signals |
| `/seo-page` | User wants a deep single-page analysis | Detailed analysis of one URL: content, keywords, links, schema, performance |
| `/rank-tracker` | User wants to track keyword positions over time | Monitors SERP positions for target keywords |
| `/seo-drift` | User wants to detect regressions on a page that was performing | Captures baselines and compares against stored snapshots |
| `/content-refresher` | Published content is aging or losing traffic | Identifies what to update: stale stats, new competitors, decayed sections |
| `/performance-reporter` | User wants a dashboard or report on content performance | SEO/GEO reports with KPI tracking |

---

## Data integrations

Available throughout the workflow. Use when a skill above needs live data, or when the user asks for real numbers.

| Skill | What it connects to | When to use |
|-------|-------------------|-------------|
| `/seo-google` | Google Search Console, PageSpeed, CrUX, GA4 | Validating current rankings, indexation, CWV scores, or traffic data for an existing page |
| `/seo-dataforseo` | Live SERP data, keyword metrics, backlinks via DataForSEO API | Pulling real-time search volume, keyword difficulty, SERP features, or competitor data. Prefer this over estimates when available. |
| `/seo-firecrawl` | Full-site crawling via Firecrawl | Crawling a site for technical SEO data, internal link structure, or content inventory |
| `/seo-backlinks` | Backlink profile analysis | Checking link signals for a page or domain. Useful during competitor analysis or when planning linkable assets. |
| `/domain-authority-auditor` | Domain authority and competitive position | Assessing how aggressive keyword targeting can be based on the domain's current authority |

---

## Quick decision tree

Use this to decide what to run at each stage without reading the full tables:

```
RESEARCH PHASE
  └─ Do we have keywords?
       ├─ No → /keyword-research
       └─ Yes → Do we know what's ranking?
            ├─ No → /serp-analysis
            └─ Yes → proceed to outline

OUTLINE APPROVED
  └─ Does the user want deeper research?
       ├─ Yes → offer /seo-content-brief, /content-gap-analysis
       └─ No → proceed to draft

DRAFT COMPLETE
  └─ Will this live on bolt.new?
       ├─ Yes → generate meta tags, check internal links
       │    └─ High GEO priority? → /geo-content-optimizer
       │    └─ Has FAQ/HowTo? → /schema-markup-generator
       └─ No (social, email, internal) → skip SEO/GEO skills

POST-PUBLISH
  └─ User shares live URL?
       ├─ Yes → offer /seo-audit or /seo-page
       └─ Tracking performance? → /rank-tracker, /performance-reporter
```
