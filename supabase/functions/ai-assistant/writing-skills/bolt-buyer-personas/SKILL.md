---
name: bolt-buyer-personas
description: >
  Bolt.new buyer persona profiles. Single source of truth for target audience definitions,
  voice adjustments, readability calibration, and content approach across all Bolt.new content.
  Use this skill when the user asks about personas, target audiences, buyer profiles, competitive
  landscape, or third-party research and stats for a specific audience. Also triggers on audience
  selection in any content workflow, or when a skill references "persona", "target audience",
  or "buyer persona".
metadata:
  version: 1.3.0
---

# Bolt.new Buyer Personas

Six target audience profiles that govern voice, depth, vocabulary, examples, and CTAs across all Bolt.new content. Every content skill that targets a specific audience should read the relevant persona here before drafting.

## Reference files

| File | What it contains | When to read it |
|------|-----------------|-----------------|
| `third-party-research.md` | Sourced stats, pull quotes, and cross-persona themes from 13 external studies (Stack Overflow, METR, Korn Ferry, McKinsey, Bain, Adobe, HubSpot, Salesforce, CoSchedule, Microsoft, PwC, Stanford HAI, arXiv). Organized by persona with ready-to-use citations. | When content needs external credibility, cited data points, industry benchmarks, or quotable stats. Also read when the user asks for research, stats, or citations for a specific persona. |

## Quick reference

| # | Persona | Who they are | Voice register |
|---|---------|-------------|----------------|
| 1 | Small business owner / founder / entrepreneur | Non-technical domain expert, open to AI, needs barriers lowered | Plain language, relatable scenarios |
| 2a | Enterprise buyer: CTO / App Dev Leader | Technical gatekeeper, owns the stack and security posture | Authoritative, infrastructure-focused |
| 2b | Enterprise buyer: CPO | Product and innovation leader, owns velocity and team productivity | Authoritative, outcome-focused |
| 3 | Product manager | Bridge between business and engineering, needs speed to validation | Practical, PRD-fluent |
| 4 | Professional developer | AI power user, skeptical of AI-coded output | Technical, direct, humor welcome |
| 5 | Marketer / creative agency / creative freelancer | Design-fluent builders who deliver for clients or campaigns | Confident, visual, outcome-driven |
| 6 | General reader | Curious explorer, top-of-funnel, not buying yet | Accessible, educational |

## How to use

1. Read the relevant persona before drafting.
2. Shape every decision — angle, depth, vocabulary, examples, CTA — to match the persona.
3. The **Voice adjustment** tells you how the content should sound for this audience. Apply it on top of the Bolt.new TOV from `bolt-TOV-and-guidelines`.
4. The **What keeps them up at night** section tells you which pain points to address and which proof points to lead with.
5. The **Readability targets** tell you the technical calibration — reading level, jargon tolerance, and content approach.
6. For additional sourced stats and citations, query `third-party-research.md` in this skill directory, or use web search and internal tools (Notion, Slack, Linear) for current data.

---

## Persona 1: Small business owner / founder / entrepreneur

Smart, accomplished professionals who are very good at what they do — they just aren't technical. They have deep domain expertise in their field and run their businesses with real skill, but they're not proficient AI users. They're looking for ways to improve operations, cut costs, and stay competitive. They're open to AI but don't know where to start or what's even possible. Ambitious, hardworking, and zero patience for fluff or buzzwords. They respond to helpful, direct content that addresses their specific pain points with concrete examples of what they can actually do. Think: the special education tutor who built an entire learning platform because nothing on the market worked for his students. Write for someone who Googles solutions to real problems, not someone browsing a tech blog for fun. Respect their intelligence — they're experts in their domain, they just need the technical barriers lowered.

**Bolt.new user data** (self-reported survey, 10M+ users):

The largest segment by far — Bolt.new's core user base.

- **Scale:** ~2.07M users, 193K paid (9.35% conversion rate).
- **Workplace:** 64% solo, 16% small business, 12% VC-startup, 5% agency. 756K directly self-identified as founder/entrepreneur.
- **Technical skill:** 80% are non-technical or early learners (59% beginner, 21% basic).
- **Use case:** 43% personal projects, 37% launching a business, 8% for clients, 7% team/company.
- **Conversion insight:** Founders who work at agencies convert at 19.4% (2x the average). Small business founders at 16.6%. Solo founders at 13.8%. Revenue-generating businesses convert much more readily.
- **Top paid plans:** Pro Monthly (17.4K), Pro 50 Monthly (3.4K), Pro Yearly (3.1K), Pro 100 (1.7K). They upgrade to higher token tiers more aggressively than any other persona.
- **Top paid countries:** US (19.7K), India (6K), UK (3.9K), France (3.5K), Canada (3K), Brazil (2.4K), Australia (2.2K).
- **Acquisition:** Google (38%), AI Search (24%), YouTube (10%), Facebook (4%), Instagram (4%), TikTok (3%).
- **Growth:** 7.6K signups/month (Jan 2025) → 32K/month (Apr 2026) — 4.2x sustained growth.

**What keeps them up at night:**
- Website and digital presence costs. Agency quotes ($8K-$22K) don't match the budget. 17% of small businesses still don't have a website at all.
- Time. They can't spend months on a web project when they have a business to run.
- Loss of control. They know exactly what they want but lose it in translation with developers and agencies. Revision rounds, misinterpretations, and a final product that's close but not quite right.
- The AI knowledge gap. They see competitors adopting AI but don't know what's real vs. hype, or where to start.
- Tool overwhelm. They don't want to learn a complex platform — they want to describe what they need and get it.

**What resonates with them:**
- Cost comparison: $20/month vs. $12,000 upfront.
- Speed: afternoon vs. months.
- Control: you make every decision, not a developer interpreting a brief.
- Real examples from people like them — landscapers, tutors, consultants — not tech companies.

**How they use Bolt.new:**
- Building MVPs fast without a full dev team.
- Creating marketing microsites, campaign pages, and landing pages without developers.
- Building sales dashboards and enablement tools.
- Rapid demos and customer-facing prototypes.
- Internal BI tools and customer feedback aggregation.

**Roles that map here:** Executive / Founder (CEO, CTO, COO), Sales / Business Development Leader. Common thread: they need to build something now, can't wait for dev resources, and don't have a technical background.

**Third-party research:**

> "75% of leaders whose organizations invested in AI report positive ROI; only 4% report negative ROI." — HubSpot AI Trends 2025

For additional sourced stats, pull quotes, and citations for this persona, query `third-party-research.md` or use web search and internal tools for current data.

**Competitive landscape:**

*AI builders (shared across all personas):*
- **Lovable:** Polished output quality and simple deployment. Credit-based pricing ($25/mo for 100 credits). Requires Supabase for backend — adds configuration friction this persona won't tolerate. Has had security incidents. Better for quick UI than full business sites.
- **Replit:** All-in-one environment (IDE, database, deployment). Effort-based Agent pricing is unpredictable — reports of $600+ surprise charges. Feels like a developer environment, not an app builder. Steeper learning curve than Bolt.new.
- **Base44:** Positioned as "Retool for non-developers." Built-in auth, roles, and Stripe integration. Good for simple business apps (booking, inventory, CRM-lite). Dual credit system means ongoing costs scale with app usage, not just development. Less mature ecosystem.

*Persona-specific competitors:*
- **Squarespace / Wix:** Their current default. Template-based, easy to start, but they hit the ceiling fast. Both have added AI features (Squarespace Blueprint AI, Wix Aria) but it's still template generation, not custom building. No backend logic, no database, no custom functionality. Bolt.new wins when the template isn't enough — which is exactly the frustration that drives this persona to look for alternatives.
- **WordPress + Elementor:** Flexible but maintenance-heavy. Plugin sprawl, security updates, hosting management, and theme conflicts create ongoing headaches. Bolt.new eliminates the maintenance burden entirely.
- **Shopify:** Dominant for e-commerce but locked to the Shopify ecosystem. Expensive at scale with transaction fees and app costs stacking up. For businesses that need a site + some commerce (not a full e-commerce operation), Bolt.new is more flexible and cheaper.
- **Hiring a freelancer or agency:** The incumbent "solution" for most of this persona. $1,500-$22,000 upfront, weeks to months of timeline, revision cycles, and a final product they can't easily update themselves. Bolt.new doesn't just compete on price — it removes the translation layer entirely.

*Enterprise SaaS Bolt.new can replace:*

This persona pays for SaaS products that do far more than they need — and they can't customize the parts that matter most to their business. Custom-built alternatives on Bolt.new cost a fraction and do exactly what they need.

| Instead of... | Build this on Bolt.new | Why it wins |
|---|---|---|
| HubSpot / Salesforce CRM ($50-300/mo) | Custom CRM with the fields, views, and workflows that match how they actually sell | Most SMBs use 10-15% of CRM features; a fit-for-purpose build eliminates the bloat and the learning curve |
| Calendly / Acuity ($16-45/mo per seat) | Branded booking system integrated into their site | One build, no per-seat fees, fully customized to their service types and availability logic |
| Monday.com / Asana ($10-30/seat/mo) | Project tracker or client portal built around their workflow | They don't need 200 features — they need a board that matches how their team works |
| Freshbooks / QuickBooks invoicing tier ($30-60/mo) | Custom invoicing and payment tracking | Simple send/track/remind flow without accounting software they don't use |
| Zendesk / Freshdesk ($49-150/agent/mo) | Customer support portal with ticket routing | Most small businesses need a simple intake → assign → resolve flow, not enterprise help desk |
| ServiceTitan / Jobber ($50-300/mo) | Service booking and dispatch app for field services | Built for how their specific business operates, not a generic field service template |

**Voice adjustment:** Plain language. No jargon. Show, don't tell — lead with relatable scenarios and real outcomes. The CTA should feel like a natural next step, not a sales pitch.

**Readability targets:**
- Flesch Reading Ease: 60-70
- Jargon density: low threshold — flag technical terms without explanation
- Content approach: lead with relatable scenarios and real outcomes, concrete examples of what they can actually do

---

## Persona 2: Enterprise buyer

Has a complicated relationship with AI. They want it, but they need it to be secure, governed, and a clear value-add. They're looking to replace dated workflows and niche SaaS products with AI-powered alternatives, but they want tools that integrate into their existing ways of working — not something that requires uprooting their entire stack to accommodate a "power tool." Their developers are likely already using Cursor or Claude Code, but people outside IT often can't access AI tools to experiment or test ideas because the broader tech stack is tightly controlled. They care about compliance, ROI, and reducing tool sprawl.

**Bolt.new user data** (both subgroups — proxy from self-reported survey, 10M+ users):

No direct "IT leader" or "enterprise buyer" role in the survey. This is a proxy based on users who work at large/mid companies and build for their team or company.

- **Scale:** ~50K users, 4.2K paid (8.45% conversion).
- **Workplace:** 57% large enterprise, 43% mid-size companies. 100% team-or-company use case (by definition of the proxy).
- **Caveat:** The real enterprise buyer population extends into customers tracked via HubSpot deals (39 active enterprise deals, $2.08M ARR). The survey proxy captures the bottom-up adoption signal — individual users building for their team before a formal enterprise agreement exists.
- **Content implication:** Bottom-up adoption is real. Many enterprise deals start with individual users on Pro plans who later trigger a team or enterprise conversation. Content that reaches individual practitioners (developers, PMs, marketers at large companies) feeds the enterprise pipeline.

**Shared enterprise concerns** (both subgroups):
- SSO and authentication — table stakes for any enterprise deployment.
- Security and compliance reviews (SOC 2 Type 2, DPAs, data sovereignty) add four to six weeks to every sales cycle.
- Admin controls and governance — centralized user management, usage analytics, permission controls.
- Token management and predictable costs — shared pools, consumption visibility, forecastable pricing.

**Competitive landscape** (both subgroups):

*AI builders:*
- **Lovable:** Perceived faster for interactive UI, polished output. Credit-based pricing. Weaker on enterprise governance, production deployment, and security posture. Backend requires Supabase — adds complexity and a third-party dependency the security team will scrutinize. Has had security incidents.
- **Replit:** Full development environment with deployment. Effort-based Agent pricing creates unpredictable costs — problematic for enterprise budgeting. More developer-oriented, less accessible to non-technical users the enterprise wants to empower.
- **Base44:** Good for simple internal apps with built-in auth and roles. Dual credit system (builder + integration credits) means costs scale with end-user activity — harder to forecast at enterprise scale. Less mature ecosystem, smaller community.
- **v0 (Vercel):** Best-in-class UI component generation. Tight Vercel ecosystem. Newer full-stack capabilities are less proven — benchmarks show agent failures on complex builds. Weaker on enterprise controls and design system integration. Frontend-first, not full-app.

*Enterprise-specific differentiators for Bolt.new:*
- WebContainers: browser-based execution with no remote server dependency — a fundamentally different security model than competitors running code on their servers.
- Native GitHub Enterprise integration vs. competitors that require manual code export.
- Granular admin controls and publishing governance vs. competitors with minimal enterprise feature sets.
- Design System Agent for enforcing brand consistency at scale — no equivalent in Lovable, Replit, or Base44.
- Multi-stakeholder collaboration: developers, PMs, designers, and marketers can all work in the same tool — competitors force different tools for different roles.

**Voice adjustment** (both subgroups): Authoritative and specific. Speak to constraints as features, not obstacles. Concrete business outcomes and cost comparisons. No aspirational AI hype — they're buying results, not vision.

**Readability targets** (both subgroups):
- Flesch Reading Ease: 55-65
- Jargon density: moderate — industry terms (ROI, compliance, governance, tool sprawl, SSO, SOC 2) are expected
- Content approach: concrete business outcomes, cost comparisons, constraint-as-feature framing

### Persona 2a: CTO / App Dev Leader

The technical gatekeeper. Responsible for the engineering organization, the tech stack, and the infrastructure that everything runs on. They evaluate tools through the lens of code quality, security posture, and integration with existing systems. Their primary question isn't "is this useful?" — it's "can this run in our environment without breaking anything?"

**Where their head is at:**
The CTO conversation has moved past "should we use AI coding tools" to "how do we adopt them without creating long-term engineering problems." They're optimistic about the productivity upside — especially for prototyping, repetitive development work, and delivery velocity — but they see a core tension: AI dramatically lowers the cost and speed of creation, while software accountability still belongs to humans. Code generation is outpacing validation. Review, testing, architecture governance, and debugging aren't scaling at the same rate as output. The fear isn't that AI writes bad code all the time — it's that subtle mistakes, architectural inconsistencies, and hidden technical debt become harder to detect at scale. "Shadow AI" is a growing issue: developers adopting unauthorized tools faster than governance policies can keep up, echoing earlier concerns around cloud adoption and open-source governance. They also worry about junior developers becoming dependent on AI before building foundational debugging and systems design skills, while senior engineers become bottlenecked as validators of machine-generated output. Their conclusion: governance, architecture, maintainability, and operational discipline are becoming more important, not less.

**What keeps them up at night:**
- The prototype-to-production gap. Moving a working demo into their CI/CD pipeline, GitHub Enterprise, and deployment infrastructure is where most AI tools fail. Manual migration adds months — Deloitte reported one project ballooning from three weeks to three months.
- Code quality at scale. AI generates code faster than teams can review and architect. Subtle inconsistencies and hidden technical debt accumulate when validation doesn't keep pace with generation.
- Security posture. They need outbound IPs defined, Artifactory whitelisting, and clear data-sovereignty documentation before anything touches their network. A six-week security review is standard. Shadow AI usage compounds the risk.
- Ungoverned code entering the codebase. As non-technical users gain the ability to generate production-quality output, the CTO needs guardrails that prevent unreviewed code from shipping.
- Infrastructure integration. Native publishing must be disableable. GitHub organization integration can't create duplicate teams. The tool must fit into their existing deployment architecture, not replace it.
- Engineering culture. Junior developers skipping foundational learning. Senior engineers bottlenecked as reviewers. The org needs to maintain engineering discipline even as output accelerates.

**What resonates with them:**
- Production-ready code that integrates with existing CI/CD pipelines — not prototypes that need to be rewritten.
- WebContainers as a security model — isolated browser-based execution, no remote server dependency, full visibility.
- Native GitHub Enterprise integration for real dev handoff.
- Granular admin controls: disable integrations per security policy, manage publishing permissions, control what non-technical users can deploy.
- Self-service licensing where team admins manage seats without vendor intervention.

**How they use Bolt.new:**
- Security and compliance posture review (SOC 2 Type 2, penetration testing, data sovereignty).
- Managing internal vs. external publishing with access controls.
- Integrating WebContainers SDK into existing platforms and developer infrastructure.
- Providing a secure, browser-based IDE for non-technical employees while maintaining engineering governance.

**Roles that map here:** CTO, VP Engineering, Director of Engineering, IT / Security Leader, Solution Architect. Common thread: they own the stack and the security posture. Nothing gets deployed without their sign-off.

**Third-party research:**

> "Code writing and testing account for only 25-35% of time from concept to product launch — AI assistants don't touch the rest." — Bain, From Pilots to Payoff 2025

For additional sourced stats, pull quotes, and citations for this persona, query `third-party-research.md` or use web search and internal tools for current data.

**CTO-specific competitors:**
- **Cursor:** $2B ARR, 60% enterprise revenue. Pro $20/mo, Business $40/seat/mo. The CTO's developers are likely already using it. It's a code editor, not an app builder — complementary to Bolt.new, not a replacement. Cursor handles refactoring and line-by-line work in existing codebases; Bolt.new handles full-app generation and empowers non-developers. The CTO evaluates whether both can coexist under one governance model.
- **GitHub Copilot:** Ubiquitous in enterprise dev environments. Integrated with GitHub ecosystem the CTO already controls. Autocomplete-level AI, not full-app generation. Same complementary framing as Cursor.
- **Retool:** Internal tool builder. Free for 5 users, Team $10/user/mo, Business $50/user/mo (where SSO lives — a 5x price jump). Developer-oriented, drag-and-drop for dashboards and admin panels. The CTO evaluates Retool for internal tools and Bolt.new for broader app generation. Retool's 5x jump to Business tier for SSO is a friction point.
- **Windsurf (Codeium):** AI-powered IDE competing with Cursor. Similar positioning — developer tool, not an app builder. The CTO cares about which AI coding tools their developers are adopting and whether governance keeps pace.

**Enterprise SaaS Bolt.new can replace** (CTO lens — infrastructure and internal tooling):

| Instead of... | Build this on Bolt.new | Why it wins |
|---|---|---|
| Retool ($50/user/mo at Business tier) | Custom internal admin dashboards and tools | No per-user pricing; built on the same stack the engineering team already works in |
| Tableau / Looker / Power BI ($35-75/user/mo) | Internal data visualization dashboards | Most teams need a few key views, not a full BI platform. Custom build costs a fraction for focused use cases |
| ServiceNow ($100+/user/mo) | IT service management and ticketing | Simple intake → assign → resolve workflows don't need enterprise ITSM pricing |
| Datadog / New Relic monitoring UIs ($15-30/host/mo) | Custom monitoring dashboards pulling from existing APIs | Read-only dashboards that show exactly what the team needs, integrated with existing infrastructure |

### Persona 2b: CPO (Chief Product Officer)

The product and innovation leader. Responsible for product velocity, team productivity, and the ROI of tools that their product organization uses. They evaluate tools through the lens of speed, cost per seat, and whether it unlocks capacity their product teams don't currently have. Their primary question is "does this make my product org faster and less dependent on engineering?"

**Where their head is at:**
The CPO conversation has shifted from "how do we build faster" to "how do we build better when everyone can build fast." AI tools have effectively removed execution speed as a differentiator — any team can generate an app, a prototype, or a landing page in hours. That changes the CPO's competitive calculus: if the barrier to building is gone, the advantage shifts to product taste, experience quality, and strategic vision. The core tension is that faster creation doesn't guarantee better products. When prototyping is cheap, the risk is building more things without building the right things. Volume goes up, but signal-to-noise can go down. CPOs worry about product quality and customer trust: AI-generated interfaces that look polished but feel generic, outputs that ship faster but erode the brand's quality bar, and a widening gap between "technically functional" and "genuinely good." There's also a team evolution underway — PMs are becoming more technical, designers are shipping directly, and the CPO's role is evolving from roadmap manager to experience curator. The CPO who succeeds in this environment isn't the one who ships the most features; it's the one whose team consistently ships features that matter.

**What keeps them up at night:**
- Eng capacity as the bottleneck. Their PMs have ideas and validation needs that sit in the engineering backlog for weeks. Every day a prototype waits is a day of lost customer signal.
- Product quality at scale. When anyone on the team can build, more things ship. The CPO needs to ensure volume doesn't dilute quality — that the product org is building the right things, not just more things.
- The commoditization of execution. If every competitor can build and iterate at the same speed, the advantage shifts to taste, strategy, and experience quality. The CPO needs to protect differentiation when the mechanics of building are no longer differentiating.
- Token economics and per-seat costs. At 65+ seats, the math matters. They need consumption-based models, usage visibility across teams, and pricing they can defend to the CFO.
- The trust gap in AI output. 24% of PMs don't trust AI-generated output enough to show stakeholders. If the CPO invests in Bolt.new and their PMs still don't use it, the ROI case collapses.
- Customer trust erosion. AI-generated interfaces that look polished but feel generic can erode the quality bar customers expect. The CPO is accountable for the experience, regardless of how it was built.
- Design system fidelity. Prototypes that don't match the product's actual look and feel undermine credibility with stakeholders and engineering.
- Tool sprawl. Their PMs are already using five or six AI tools (survey data: GitHub Copilot 55%, Claude Code 52%, Cursor 31%, Windsurf 28%). The CPO wants to consolidate, not add another tool to the stack.

**What resonates with them:**
- The ability for PMs and designers to build without consuming eng capacity, while IT retains governance.
- Speed to stakeholder buy-in: show something working instead of a slide deck.
- Design System Agent for brand consistency and pixel-perfect output from non-technical builders.
- Unlimited token models that eliminate per-user consumption anxiety across large product teams.
- Clean handoff from Bolt.new prototype to engineering — the artifact is a starting point, not a throwaway.

**How they use Bolt.new:**
- Deploying Bolt.new across the product organization for prototyping and internal tooling.
- Evaluating ROI: comparing time-to-prototype before and after adoption.
- POC and pilot evaluations before recommending enterprise-wide rollout.
- Building internal BI, customer feedback aggregation, and product intelligence systems.
- Overseeing team-wide adoption metrics and usage patterns.

**Roles that map here:** CPO, VP Product, Director of Product, Strategic Advisor / Consultant. Common thread: they own product velocity and team productivity. They champion the tool internally if the ROI is clear.

**Third-party research:**

> "In 2022, only 15% of Fortune 1000 companies had a CPO. Today, nearly 60% do — and companies with strong CPOs outperform the market by 35%." — Korn Ferry, CPO's Guide to AI Transformation

For additional sourced stats, pull quotes, and citations for this persona, query `third-party-research.md` or use web search and internal tools for current data.

**CPO-specific competitors:**
- **Figma:** The product org's design tool. Excellent for design, but output is non-functional — it's a picture of an app, not an app. The CPO sees the Figma-to-engineering handoff as a persistent cost center. Bolt.new replaces the "Figma wireframe → static frame → 2 weeks for an engineer to code it" workflow with "describe it → see it working → refine → hand off real code."
- **v0 (Vercel):** Generates polished UI components. The CPO might see v0 as a prototyping option for the product team. But it's frontend-first, Vercel-locked, and benchmark testing shows agent failures on complex full-app builds. Bolt.new generates full working apps, not just components.
- **Retool:** The CPO evaluates Retool for internal tools the product org needs (dashboards, admin panels). Developer-oriented — PMs can't use it independently. The 5x price jump to Business tier for SSO is a budget conversation the CPO doesn't want to have with the CFO.
- **Notion / Coda:** Where the product org lives for documentation and lightweight project tracking. Not a building tool, but the CPO compares the "PM writes a spec in Notion" workflow against "PM builds a working prototype in Bolt.new." The prototype is more convincing to stakeholders and costs less eng time.

**Enterprise SaaS Bolt.new can replace** (CPO lens — product org tooling and team productivity):

| Instead of... | Build this on Bolt.new | Why it wins |
|---|---|---|
| Mixpanel / Amplitude ($25K-100K+/yr) | Custom product analytics dashboards | Event-based pricing scales painfully. A focused dashboard pulling from existing data sources costs a fraction |
| Productboard / Aha! ($20-80/user/mo) | Custom feedback aggregation and prioritization tool | Built around how the product team actually triages, not a generic framework they have to configure |
| Pendo / WalkMe ($20K-100K+/yr) | Customer onboarding flows and in-app guides | Simple guided experiences without enterprise onboarding platform pricing |
| Jira ($8-16/user/mo, complexity compounds) | Lightweight project tracker for the product org | PMs don't need Jira's complexity for tracking product experiments and validation work |

---

## Persona 3: Product manager

Wants a way to build and refine prototypes of digital products they can validate with stakeholders and then hand over to engineering as a production-ready artifact. They sit between business goals and technical execution and need tools that let them move fast without being blocked by eng capacity. They care about speed to validation, fidelity of prototypes, and clean handoffs.

**Bolt.new user data** (self-reported survey, 10M+ users):

The smallest direct-role segment — but the highest paid conversion rate. Strongest product-market fit signal across all personas.

- **Scale:** ~154K users, 17.6K paid (11.46% conversion — nearly 2x the developer rate).
- **Technical skill:** 79% non-technical (53% beginner, 26% basic). They convert at the highest rate despite having among the lowest technical skillsets.
- **Use case:** 45% personal projects, 22% launching a business, 18% team/company, 7% client work. Disproportionately at VC-startups and mid/large companies.
- **Top paid plans:** Pro Monthly (4K), Pro 50 (470), Pro Yearly (319), Pro 100 (188).
- **Top paid countries:** US (3.4K), India (1.4K), UK (578), Japan (516), Brazil (451), Germany (404), Canada (374). Japan ranks unusually high for this role — #4 for paid PMs.
- **Acquisition:** Google (40%), AI Search (19%), Other (10%), YouTube (8%), Friends/WOM (7%), TikTok (4%).
- **Growth:** 1.4K signups/month (Jan 2025) → 7.7K/month (Apr 2026) — 5.7x sustained growth.
- **Content implication:** PMs are using Bolt.new to prototype without involving engineering — the conversion rate confirms this is working. They upgrade because the tool directly replaces a bottleneck they feel every day.

**What research tells us (N=126 PM survey, April 2026):**

This audience is already deep into AI tools. 82% use them daily, and over half use multiple tools for advanced work. They're not exploring — they're power users with strong opinions about what works and what doesn't.

- **Tools they're already using:** GitHub Copilot (55%), Claude Code (52%), Cursor (31%), Windsurf (28%), Replit (17%), Bolt.new (14%), Lovable (13%). Bolt.new has room to grow — most PMs haven't tried it yet.
- **What they use AI tools for:** Writing and debugging code, exploring technical feasibility, and automating repetitive tasks (all 49%). Internal tools and dashboards (44%). Building prototypes (42%). UI mockups (38%). They're building real things, not just prototyping.
- **How it changed their relationship with engineering:** 38% now involve engineering earlier because they can show working prototypes instead of specs. 30% involve engineering later because they validate ideas independently first. Only 2% said "no change."
- **What they value most:** Ability to test and validate ideas independently (49%). Less back-and-forth with engineering on early-stage concepts (43%). Faster idea-to-prototype (40%). Reduced dependency on engineering for non-core work (39%). More confidence in technical conversations (39%).
- **What frustrates them:** Security and compliance concerns (44% — the top friction point, even among power users). Output not production-ready (37%). Hard to integrate with existing systems (37%). Steep learning curve (31%). Hard to maintain or iterate on generated output (29%). Don't trust the output enough to share with stakeholders (24%).
- **What they wish they could do:** Keep product and documentation always in sync (48%). Build more internal apps, workflows, and agents (48%). Test and validate ideas before they're fully built (46%). Launch small features or experiments independently (45%).
- **10% are locked out.** They can only use company-approved AI tools — their IT policy prevents them from accessing tools like Bolt.new even if they want to.

**What keeps them up at night:**
- The trust gap. Nearly a quarter of PMs don't trust AI output enough to show stakeholders. They need confidence that what they build is presentable and real — not a demo that falls apart under scrutiny.
- Security blocking adoption. Even PMs who love these tools hit walls when security reviews flag compliance concerns. This is the number one friction point.
- The maintenance problem. They can build something quickly, but iterating on it and integrating it with existing systems is where the process breaks down.
- Eng capacity. They're constantly blocked waiting for engineering to build things they could validate themselves if they had the right tools.
- Documentation drift. The strongest unmet need: keeping the product and its documentation in sync as things evolve.

**What resonates with them:**
- "Show, don't spec" — the shift from writing PRDs to showing working prototypes.
- Independence from the eng backlog for validation and internal tools.
- Speed to stakeholder buy-in (show something working instead of a deck).
- Real, deployable output that engineering can pick up and refine — not a throwaway prototype.
- Design system fidelity so prototypes match the actual product's look and feel.

**How they use Bolt.new:**
- Rapid prototyping ideas before engineering investment.
- Building internal dashboards and data visualization tools.
- Creating shareable prototypes to hand off to dev teams (replacing static PRDs).
- Early customer feedback loops with lightweight builds.
- Bridging the design-to-code gap — building from design, handing off to engineering.
- Using the Design System Agent for brand consistency and pixel-perfect output.

**Roles that map here:** Product Manager / Product Lead. Common thread: they sit between vision and execution, need to validate before committing eng resources, and care about fidelity.

**Third-party research:**

> "Only 17% of developers say AI improves team collaboration — the lowest-rated benefit by a wide margin." — Stack Overflow Developer Survey 2025

For additional sourced stats, pull quotes, and citations for this persona, query `third-party-research.md` or use web search and internal tools for current data.

**Competitive landscape:**

*AI builders:*
- **Lovable:** PMs see it as the closest alternative for rapid prototyping. Polished output, simple deployment. But requires Supabase for backend (configuration friction for a non-technical PM), and credit-based pricing means cost anxiety when iterating heavily. Bolt.new's unlimited token models and fuller backend capabilities win for PMs building real working prototypes, not just UI.
- **Replit:** Too developer-oriented for most PMs. The IDE-style interface and effort-based pricing create barriers. PMs who tried it report feeling like they need to understand file structures and package management — exactly the kind of technical overhead they're trying to avoid.
- **Base44:** Good for simple internal apps (booking, CRM-lite). PMs building lightweight internal tools might reach for it. Weaker on design fidelity and complex prototypes — the things PMs need when validating product ideas with stakeholders.

*PM-specific competitors:*
- **Figma:** Where PMs go to create mockups today. The output looks good but isn't functional — a PM can show a Figma prototype in a stakeholder meeting, but they can't let someone use it. Bolt.new replaces Figma as the prototyping step for PMs who want to show something working, not just something drawn.
- **v0 (Vercel):** Generates polished UI components from prompts. PMs who've seen the output quality are impressed. But v0 produces components, not full apps — a PM who needs a working prototype with navigation, data, and flows will outgrow it quickly. Benchmark testing shows v0's agent fails on complex full-app builds.
- **Retool:** PMs building internal dashboards and admin tools evaluate Retool. It's powerful but developer-oriented — most PMs can't use it independently without eng support, which defeats the purpose. The 10% of PMs locked out by IT policy (survey data) face the same access problem with Retool.
- **Cursor / Claude Code:** 52% of PMs in the survey already use Claude Code; 31% use Cursor. These are code-writing tools, not app builders — PMs use them for smaller tasks (scripts, automation, debugging) but need Bolt.new for full prototype and app generation.

*Enterprise SaaS Bolt.new can replace* (PM lens — validation and internal tooling):

| Instead of... | Build this on Bolt.new | Why it wins |
|---|---|---|
| InVision / Marvel ($15-25/user/mo) | Working prototypes instead of clickable mockups | Stakeholders interact with real functionality, not linked static screens |
| Airtable ($20-45/user/mo) | Custom internal tools, trackers, and databases | Purpose-built for the PM's exact workflow instead of shoe-horned into a spreadsheet-database hybrid |
| Retool ($50/user/mo at Business) | Internal dashboards and admin panels | PM builds it independently without waiting for eng, no per-user enterprise pricing |
| Typeform / SurveyMonkey ($25-75/mo) | Custom customer feedback and research tools | Integrated with the product, branded, and tailored to specific research questions |
| Confluence / Notion (knowledge base) | Interactive documentation that stays in sync with the product | The strongest unmet need (48% of PMs): product-documentation sync |

**Voice adjustment:** Practical and outcome-oriented. Frame Bolt.new as the bridge between idea and validated artifact. Use language they'd use in a PRD or stakeholder review — features, user stories, iteration cycles. They don't need deep technical detail, but they do need to trust that what they build is real enough to ship.

**Readability targets:**
- Flesch Reading Ease: 55-65
- Jargon density: moderate — PM vocabulary (PRD, user stories, iteration, validation, CI/CD handoff) is expected
- Content approach: frame around speed to validation, fidelity, and clean handoffs to engineering

---

## Persona 4: Professional developer

Already a power user of AI in their own workflows. Skeptical of AI-coded artifacts because they've seen too many that aren't production-ready and can't be integrated into a real codebase. Open to new tools, but only if they fit the way they already work. They want governance and control over any development tool. Sophisticated technical user with a sense of humor and a zero-tolerance policy on bullshit. They appreciate technical depth and nuance but will bounce the second they smell buzzwords or hyperbole.

**Bolt.new user data** (self-reported survey, 10M+ users):

The most technically skilled segment — and the hardest to convert.

- **Scale:** ~734K users, 45.4K paid (6.19% conversion — lowest across all personas).
- **Skillset:** 60% fullstack, 24% frontend, 16% backend.
- **Use case:** 54% personal projects, 16% launching a business, 10% team/company, 10% client work.
- **Top paid plans:** Pro Monthly (5K), Pro 50 Monthly (784), Pro Yearly (651). They upgrade to higher token tiers less frequently than founders.
- **Top paid countries:** US (4.2K), India (3.4K), Brazil (1.3K), France (903), UK (844), Indonesia (843), Turkey (771), Japan (758). Broadest global distribution of paid users — strong emerging market adoption (India, Indonesia, Turkey, Kenya).
- **Acquisition:** Google (38%), AI Search (20%), YouTube (12%), Friends/WOM (7%), Instagram (4%), TikTok (4%).
- **Growth:** 9K signups/month (Jan 2025) → 23.4K/month (Apr 2026) — 2.6x sustained growth (most normalized of any persona post-spike).
- **Content implication:** Developers have the lowest conversion rate despite being a huge segment. They may need different positioning — speed/prototyping and full-app generation rather than no-code messaging. They're the hardest audience to convert with traditional marketing; trust and technical credibility are the only paths in.

**What we hear from the field** (enterprise customer and prospect conversations):

Developers are the people who inherit what everyone else builds. Every pain point in the enterprise AI adoption story lands on their desk eventually.

- **Prototypes arrive dead on arrival.** Engineering teams routinely rebuild prototypes from scratch because the generated code doesn't match the production stack or design system. Figma handoffs, AI-generated scaffolds, PM-built prototypes — they all hit the same wall. One team described prototypes as "artifacts from outer space." Refactoring consumes weeks to months per feature cycle.
- **They're the bottleneck and they know it.** Product and business teams are moving faster than engineering can absorb. Internal tools, dashboards, and validation work sit in the eng backlog for weeks. Developers are the single point of failure for shipping anything — and they're tired of it. The irony: tools that claim to "free up engineering" often create more cleanup work.
- **Brand drift from ungoverned output.** When non-technical users prototype freely, the output rarely matches brand standards. No enforcement of shared component libraries or design tokens means every prototype is a one-off. One enterprise had to roll back to a centralized process after fragmentation got out of hand.
- **Legacy codebases resist AI tooling.** Teams with 10+ year-old codebases report that AI tools struggle to integrate. Outdated front-end frameworks break agentic workflows. Large monorepo architectures can't be loaded into browser-based tools. Feature flag debt, orphan database tables, and unresolved schema issues compound every adoption attempt.
- **App sprawl is the new dashboard sprawl.** Every enterprise that democratized reporting ended up with 10,000 uncontrolled Power BI dashboards. Developers see the same pattern emerging with AI-generated apps — proliferation without governance, audit trails, or retirement plans.
- **Tooling reliability erodes trust.** 15-20 minute build checks and multi-minute NPM installs kill developer momentum. Slow feedback loops between code change and preview undermine confidence in the tool itself. Pricing opacity from incumbent tools is accelerating competitive displacement.

**What keeps them up at night:**
- Code quality. 37% of PMs who use AI tools say the output isn't production-ready — developers see this even more acutely. They've reviewed too many AI-generated PRs that look right but break in edge cases.
- The prototype-to-production gap. Moving a working demo into their CI/CD pipeline and production architecture is where most AI tools fail. The prototype works in isolation; integrating it with the real codebase creates more work than building from scratch.
- Integration with legacy codebases. AI-generated code that can't be refactored into an established architecture, older framework version, or monorepo creates more work, not less. The teams that need help the most can benefit the least.
- Governance and control. They want to choose models, control where code runs, manage dependencies, and maintain visibility into what the AI is doing. Black-box tools are a non-starter.
- Non-technical users shipping unreviewed code. As PMs and designers gain the ability to generate production-quality output, developers worry about ungoverned code entering the codebase without proper review — and ungoverned apps proliferating without audit trails.
- Tooling performance. Slow build times, unreliable previews, and long feedback loops erode trust fast. If the tool wastes their time, they'll drop it regardless of what it can do.

**What resonates with them:**
- Production-ready code quality — not templates, not prototypes, actual code they can refactor and deploy.
- WebContainer architecture: isolated browser-based execution, no remote server dependency, full visibility into what's running.
- Native GitHub integration and CI/CD pipeline compatibility — the code meets them where they already work.
- Design system ingestion (private NPM packages, Figma libraries) that enforces consistency and prevents the brand drift they've seen from ungoverned prototyping.
- Honest messaging about tradeoffs. If Bolt.new is better for full-app generation and worse for line-by-line refactoring in an existing codebase, say so.
- Governance that scales. Admin controls, publishing permissions, and audit trails that prevent the app sprawl problem they've seen play out with every previous democratization wave.

**How they use Bolt.new:**
- Building internal tooling and apps.
- Integrating WebContainers SDK into existing platforms and building in-browser coding environments with no local environment setup.
- Integrating Bolt.new CLI with Cursor or Claude Code for dev handoff.
- Sandboxed testing and production-facing app development.
- API-based consumption for internal developer infrastructure.

**Roles that map here:** Software Engineer / Developer, Solution Architect / Technical Program Manager. Common thread: they care about the architecture, the integration points, and whether the output is real code they can work with.

**Third-party research:**

> "20% of developers report reduced confidence in their own problem-solving after using AI tools." — Stack Overflow Developer Survey 2025

For additional sourced stats, pull quotes, and citations for this persona, query `third-party-research.md` or use web search and internal tools for current data.

**Competitive landscape:**

Developers evaluate Bolt.new differently than every other persona. Their primary tools are Cursor and GitHub Copilot — optimized for code-level refactoring within existing codebases. Bolt.new isn't replacing their IDE-based AI. It's the tool that lets non-engineers build things without consuming dev capacity, while producing output developers can actually work with.

*AI builders:*
- **Lovable:** Generates polished React apps. Developers find the output quality decent for UI but flag Supabase dependency as a backend limitation. Credit-based pricing discourages the heavy iteration developers expect. Code export exists but the codebase isn't structured the way a developer would build it — refactoring overhead.
- **Replit:** The closest to a developer's natural environment. Full IDE, built-in PostgreSQL, 50+ languages, deployment. But effort-based Agent pricing has burned developers with surprise charges ($600+ reported). Replit competes for developers' own projects; Bolt.new competes for the apps that would otherwise land on the developer's backlog from other teams.
- **Base44:** Too simple for most developers. Good for quick internal business apps but the code isn't production-grade by developer standards. Dual credit system is a non-starter for serious development. Developers might recommend it to non-technical colleagues for simple needs.

*Developer-specific competitors:*
- **Cursor:** $2B ARR, 60% enterprise revenue. Pro $20/mo, Business $40/seat/mo. Background agents and agent mode are powerful. This is the developer's daily driver for code-level work — refactoring, debugging, navigating large codebases. Complementary to Bolt.new, not competitive. Bolt.new CLI integrates with Cursor for handoff. The honest framing: Cursor for working in existing code, Bolt.new for generating new apps and empowering non-dev teammates.
- **GitHub Copilot:** Ubiquitous, integrated with the GitHub ecosystem. Autocomplete-level AI — fast for line-by-line suggestions, not full-app generation. Developers use both; they serve different purposes.
- **Windsurf (Codeium):** Competing with Cursor on the AI IDE front. Similar positioning — developer tool, not an app builder. Developers switching between Cursor and Windsurf are making a different decision than choosing Bolt.new.
- **v0 (Vercel):** Generates best-in-class UI components (shadcn/ui + Tailwind). Developers building Next.js frontends appreciate the output quality. But it's component-level, not full-app. Benchmark testing shows v0's agent fails on complex builds. Vercel ecosystem lock-in. Developers use v0 for quick UI scaffolding and Bolt.new for full application generation.

*Enterprise SaaS Bolt.new can replace* (developer lens — reducing the backlog of internal tool requests):

The developer's version of this story is different: they're not replacing SaaS for themselves. They're reducing the requests that land on their desk by giving other teams a way to build what they need.

| Instead of... | Non-devs build this on Bolt.new | How it helps the developer |
|---|---|---|
| Retool ($50/user/mo at Business) | Internal admin dashboards and CRUD tools | PMs and ops teams build their own instead of filing eng tickets |
| Custom internal tools (weeks of eng time each) | Purpose-built internal apps for specific team workflows | Backlog shrinks. Developers review and refine rather than build from scratch |
| Tableau / Looker / Power BI | Data visualization dashboards for business teams | Business teams get the dashboards they need without consuming eng capacity |
| Zendesk / Freshdesk custom portals | Customer-facing portals and support tools | Customer success builds what they need; eng handles the integration points |
| One-off scripts and automations | Workflow automation apps with UIs | Ops teams stop asking for "quick scripts" that always take longer than expected |

**Voice adjustment:** Technical and direct. Earn their trust with specifics — architecture decisions, integration patterns, actual code examples. Respect their intelligence. Humor is welcome; hype is not. If something has a limitation, say so. They'd rather know the tradeoffs than get a polished pitch. The CTA should feel like an invitation to try something, not a push to convert.

**Readability targets:**
- Flesch Reading Ease: 50-60
- Jargon density: high tolerance — technical terms expected and appreciated, no need to explain standard dev vocabulary
- Content approach: earn trust with specifics, show tradeoffs honestly, code examples where relevant

---

## Persona 5: Marketer / creative agency / creative freelancer

Design-literate professionals who build for clients, campaigns, and brands. This persona spans three overlapping roles: in-house marketers who need campaign assets fast, agency creatives delivering client work on tight timelines, and freelance writers and designers expanding their service offering. What unites them: they think visually, they're comfortable with design tools (Figma, Canva, Webflow, WordPress), and they've been one step removed from building functional sites because the code layer has always required a developer or a rigid template.

AI tools change their economics. A designer who could only deliver mockups can now deliver working sites. A freelance copywriter who handed off landing page copy to a developer can now build and deliver the page themselves. An agency that quoted $8,000 for a campaign microsite can now build it in-house in a day, keep the margin, and move on to the next client.

They're not developers and don't want to be. But they're not the Persona 1 small business owner either — they have design sensibility, understand layout and UX, and have strong opinions about how things should look and feel. They're closer to power users than beginners. The barrier has always been code, not vision.

**Bolt.new user data** (self-reported survey, 10M+ users):

A combined segment spanning designers, marketers, content creators, and agency workers — and the fastest-growing persona on the platform.

- **Scale:** ~709K users, 51.2K paid (7.23% conversion).
- **Sub-segments:** Designers (236K), agency workers (127K), content creators (115K), marketers (86K). 214K users identified "clients-or-customers" as their primary use case — client work is the defining trait.
- **Technical skill:** 82% non-technical (58% beginner, 24% basic) — the highest beginner rate of any persona.
- **Top paid plans:** Pro Monthly dominates. Designers are more likely to go annual than other sub-segments.
- **Top paid countries:** US, India, UK, France, Brazil, Indonesia.
- **Acquisition by sub-segment:** Content creators are the most social-media-acquired group — YouTube (21%), TikTok (6%), Instagram (6%). Marketers have strong Facebook acquisition (5.5%). Designers index highest on Google (41%).
- **Growth:** 2K signups/month (Jan 2025) → 27.1K/month (Apr 2026) — **13.3x sustained growth**, the most durable growth of any persona relative to baseline. This segment is accelerating while others have normalized.
- **Content implication:** This audience is growing faster than any other, heavily acquired through social channels, and overwhelmingly non-technical. Content that shows visual results (before/after, live builds, client deliverables) and reaches them on YouTube, TikTok, and Instagram will have outsized impact. Agency-specific marketing is high-ROI — agency founders convert at 19.4%, the highest sub-segment conversion rate on the platform.

**Where their head is at:**

AI building tools have moved past the experimental phase for this audience. They're core creative infrastructure now — used for website creation, campaign production, workflow automation, app prototyping, and internal tool development. But the productivity gains come with a real tension: as execution becomes automated, AI-generated output is converging toward sameness. Ads look like ads. Landing pages look like landing pages. Without strong human direction, everything starts to blur together.

The three subgroups experience this differently:

- **Enterprise marketers** are compressing campaign timelines and scaling personalization toward what Adobe's marketing leadership calls "a segment of one" — hyper-personalized experiences for individual customers instead of broad audience segments. Teams are restructuring around "full-stack marketers" who use AI tools to execute across content, strategy, analytics, design, and automation without relying on large specialized support functions. But they're also discovering that AI-generated campaigns need strong brand systems and editorial judgment to avoid generic output.
- **Agency creatives** are using AI to dramatically increase delivery speed and project capacity — work that took weeks of wireframing and frontend development now compresses into days or hours. Smaller agencies are competing with firms several times their size because AI reduces the operational overhead required to deliver polished client work. The competitive shift: agencies no longer compete on production capability. They compete on strategic insight, creative direction, and client-specific customization. AI generation is the starting point; human refinement, brand direction, and custom strategy are the differentiator.
- **Freelancers** are operating more like micro-agencies — taking on more projects, delivering faster, and expanding into services (working sites, interactive prototypes, lightweight apps) that previously required a developer. But they also face the sharpest version of the commoditization anxiety. Many independent creatives worry that widespread AI adoption is creating a flood of generic output, making it harder to stand out. The fear isn't just about competition — it's about creative identity, originality, and whether AI erodes the artistic agency that defines their work.

The common conclusion across all three: the most successful teams and individuals treat AI as a force multiplier for human creative direction, not a replacement for it. The organizations gaining the most leverage are combining AI acceleration with strong editorial judgment, brand systems, and differentiated creative thinking.

**What we hear from the field** (enterprise customer and prospect conversations):

The creative side of the enterprise hits many of the same walls as product and engineering teams, but from a different angle — they're locked out of building, not bottlenecked by building.

- **Non-technical creatives are stuck in the queue.** Marketers, designers, and content strategists can't get work built without engineering support. Every landing page, campaign site, or interactive demo sits in the eng backlog alongside product work. Existing AI coding tools assume IDE familiarity — a barrier that rules out most of the marketing and creative organization.
- **The handoff destroys the work.** Prototypes built in Figma arrive in engineering as effectively useless starting points. Brand inconsistency is baked into the workflow because prototype tools produce non-production-ready code by default. Styles are off, interactions are off, and refactoring consumes weeks. For creatives who care about how things look, this is especially painful — their vision gets lost in translation the same way it does for Persona 1, but the stakes are higher because it's client-facing or campaign-critical work.
- **Ungoverned creative tooling creates drift.** When marketing teams prototype freely without enforced component libraries or design tokens, every deliverable is a one-off. Enterprises have seen this pattern escalate to the point where they rolled back to centralized processes after fragmentation got out of hand.

**What keeps them up at night:**
- Turnaround time. Clients want landing pages, campaign sites, and microsites in days, not weeks. Every project that requires a developer adds cost and calendar time they can't bill for.
- Template limitations. They've outgrown Squarespace and Wix but can't justify hiring a developer for every project. They know exactly what they want but hit the ceiling of what no-code tools allow.
- The sameness problem. AI-generated output is converging. Ads look like other ads. Landing pages look like other landing pages. Without strong creative direction and brand systems, everything they produce risks looking like everything their competitors produce. For agencies and freelancers especially, generic output is an existential threat to their value proposition.
- Design fidelity. They care deeply about how things look. AI-generated output that feels generic or off-brand is worse than no output — it undermines their professional credibility.
- Client revision cycles. The back-and-forth between client feedback and developer implementation is where margins evaporate. If they could make changes themselves in real time, they'd reclaim hours per project.
- Scope creep into development. Clients increasingly expect functional prototypes, interactive demos, and working sites — not just mockups or flat designs. The deliverable bar keeps rising.
- Commoditization anxiety (freelancers especially). If every freelancer has the same AI tools, what differentiates their work? The fear that AI erodes creative identity and originality is real, even among those who use the tools daily.
- Portfolio and proof of work. Freelancers need to show what they can build. A working site is more convincing than a Figma file in every pitch — but it has to look like *their* work, not AI's.

**What resonates with them:**
- Speed to deliverable: describe a landing page, see it built, refine it, ship it — in a single session.
- Design control without code. They can direct the visual output, adjust layouts, tweak brand elements, and iterate in real time without touching a codebase. The tool amplifies their creative direction rather than replacing it.
- Expanded service offering. Designers who add "I build working sites" to their pitch win more contracts. Writers who deliver the page, not just the copy, increase their per-project value. Small agencies compete with firms several times their size.
- Design System Agent for maintaining client brand consistency across deliverables — the antidote to the sameness problem. Strong brand systems in, differentiated output out.
- Client-facing output that looks finished, not prototyped. The quality bar matters — they're putting their name on it.
- Cost structure that works for freelancers and small agencies: $20-200/month vs. hiring a developer per project.
- The "force multiplier" framing. AI handles execution; they bring the strategy, taste, and creative judgment that makes the output worth paying for.

**How they use Bolt.new:**
- Building campaign landing pages and microsites from a brief or creative direction.
- Creating client deliverables (working sites, interactive demos) that go beyond static mockups.
- Rapid iteration during client review sessions — making changes live instead of logging revision tickets.
- Building portfolio sites and case study pages for their own business development.
- Generating multiple design directions quickly to present client options.
- Producing event pages, product launch sites, and seasonal campaign assets on tight deadlines.

**Roles that map here:** Marketing Manager / Director, Content Strategist, Brand Manager, Creative Director (agency), Art Director, Graphic Designer, Web Designer, UX Designer (freelance), Freelance Copywriter / Content Writer, Agency Account Manager (who also builds). Common thread: they deliver visual, client-facing work and need to move from concept to functional deliverable without a developer in the loop.

**Third-party research:**

> "Only 4% of marketers use AI to write entire pieces independently — the overwhelming norm is human-directed, AI-assisted creation." — HubSpot AI Trends for Marketers 2025

For additional sourced stats, pull quotes, and citations for this persona, query `third-party-research.md` or use web search and internal tools for current data.

**Competitive landscape:**

*AI builders:*
- **Lovable:** The most direct competitor for this persona. Polished output quality — creatives are impressed by how good the UI looks. Simple deployment. But credit-based pricing ($25/mo for 100 credits) punishes the heavy iteration that creative work demands. Requires Supabase for backend, which adds a technical hurdle this audience won't tolerate. Bolt.new wins on design system integration, unlimited iterations, and full-app capability beyond UI.
- **Replit:** Too developer-oriented. The IDE interface, file structure, and effort-based pricing are barriers for creatives. Content creators who tried it report feeling lost. Not a serious contender for this persona.
- **Base44:** Good for simple business apps (booking systems, basic CRMs) that agencies build for clients. Built-in auth and Stripe integration save time on common agency deliverables. But dual credit system means costs scale with client usage — problematic for agencies handing off apps that clients use daily. Less design control than Bolt.new.

*Creative-specific competitors:*
- **Webflow:** The incumbent for design-forward creatives. Powerful visual builder with CMS and hosting. New pricing (May 2026): Premium $25/mo, Team $2,500/mo, Enterprise custom with AI credits and AEO agents. Steep learning curve — creatives report months to become proficient. Expensive at scale. A website builder, not an app builder — no custom backend logic, database, or app functionality. Bolt.new is faster to first deliverable and handles full-app builds Webflow can't touch.
- **Framer:** $2B valuation. Design-first website builder that feels like Figma. AI generates full multi-page sites from prompts. Beautiful output for marketing sites and landing pages. But it's a website builder — no backend, no auth, no database logic, no app functionality. Freelance designers love the aesthetic quality; they outgrow it when client scope expands beyond marketing sites.
- **Squarespace / Wix:** Where creatives send clients who "just need a website." Both have added AI site generation (Squarespace Blueprint AI, Wix Aria). Still template-based — the ceiling is real and this persona hits it constantly. No custom functionality, no backend logic. Bolt.new replaces the "I've outgrown Squarespace but can't afford an agency" gap.
- **Canva (Websites):** Canva's website builder is where many non-technical creatives start. Extremely easy but extremely limited. No custom functionality, minimal design flexibility beyond templates. For creatives who need more, Bolt.new is the step up without the step into code.

*Enterprise SaaS Bolt.new can replace* (creative/marketing lens — campaign and client tooling):

| Instead of... | Build this on Bolt.new | Why it wins |
|---|---|---|
| Unbounce / Instapage ($74-200/mo) | Campaign landing pages with custom forms and tracking | Full design control, no template constraints, built exactly to the brief |
| Mailchimp / Klaviyo landing pages (bundled pricing) | Standalone campaign pages independent of email platform | Purpose-built for the campaign instead of limited by the email tool's page builder |
| Miro / FigJam for client presentations ($10-20/user/mo) | Interactive client presentations and project showcases | Working prototypes are more convincing than boards of sticky notes |
| Calendly / Acuity for client scheduling ($16-45/mo) | Branded booking and intake systems for agency clients | White-labeled, matches the client's brand, no third-party branding |
| Portfolio platforms — Dribbble Pro, Behance, Carbonmade ($6-24/mo) | Custom portfolio site with interactive case studies | Working examples of what you can build are more compelling than screenshots of past work |
| WordPress + plugins for client sites ($20-100/mo + maintenance) | Client websites without ongoing maintenance overhead | No plugin updates, no security patches, no theme conflicts. Build, deliver, move on |

**Voice adjustment:** Confident and visual. Speak to their design sensibility — they care about aesthetics, brand, and craft. Use language from the creative world (deliverables, briefs, brand guidelines, revision rounds, client presentations) not engineering. Show, don't tell — before/after examples and visual output demonstrations land harder than feature lists. Light humor is fine; creative jargon is welcome; tech jargon is not.

**Readability targets:**
- Flesch Reading Ease: 60-70
- Jargon density: creative/marketing terms expected (brand guidelines, CTA, above the fold, deliverable, brief), technical terms need explanation
- Content approach: visual-first, outcome-driven, show the deliverable quality they can achieve

---

## Persona 6: General reader

Used for top-of-funnel content with broad appeal — listicles, brand-agnostic definitions, high-level educational content, and posts that touch on broader AI topics without being Bolt.new-specific. These readers are curious about AI, have likely dabbled with ChatGPT or similar tools, but aren't power users. They're exploring, not buying. Also use this persona for any content with a broad, non-specific audience.

**What keeps them up at night:**
- Whether AI is going to replace their job or make them more valuable.
- Feeling behind — everyone talks about AI, but they're not sure what's real and what's hype.
- Not knowing where to start. The tool landscape is overwhelming and changes every month.

**What resonates with them:**
- Concrete examples of what real people (not engineers) are building with AI.
- Plain-language explanations of how things work, without condescension.
- The permission to experiment — "try it and see" beats "sign up now."

**Third-party research:**

> "Corporate AI investment reached $252.3 billion in 2024, with private generative AI investment alone hitting $33.9 billion — 8.5x higher than 2022." — Stanford HAI AI Index Report 2025

For additional sourced stats, pull quotes, and citations for this persona, query `third-party-research.md` or use web search and internal tools for current data.

**Voice adjustment:** Accessible and informative. Explain concepts without being condescending. Keep the Bolt.new mentions light — this content builds brand awareness and trust, not direct conversions. The CTA might be "try it yourself" or "read more," not "sign up for enterprise."

**Readability targets:**
- Flesch Reading Ease: 60-70
- Jargon density: low threshold — explain or avoid technical terms
- Content approach: accessible, educational, Bolt.new mentions stay light

---

## Persona selection guide

When the audience isn't immediately obvious from the brief:

**By pain point:**
- **Saving money, DIY, "build it yourself," small business pain points** → Persona 1
- **Security posture, CI/CD integration, code quality, infrastructure governance** → Persona 2a (CTO)
- **Product velocity, team productivity, per-seat ROI, tool consolidation** → Persona 2b (CPO)
- **Prototyping, validation, stakeholder buy-in, PRDs, internal tools, eng handoff** → Persona 3
- **Technical depth, code quality, architecture, CI/CD, developer workflows** → Persona 4
- **Client deliverables, campaign sites, landing pages, design-to-live-site, agency margins, freelance services** → Persona 5
- **Broad educational, top-of-funnel, brand awareness, AI trends** → Persona 6

**By role:**
- Executive / Founder, Sales Leader → Persona 1
- CTO, VP Engineering, Director of Engineering, IT / Security Leader → Persona 2a
- CPO, VP Product, Director of Product, Strategic Advisor / Consultant → Persona 2b
- Product Manager → Persona 3
- Software Engineer, Solution Architect, Technical Program Manager → Persona 4
- Marketing Manager / Director, Content Strategist, Brand Manager, Creative Director, Art Director, Graphic / Web / UX Designer, Freelance Writer / Designer, Agency Account Manager → Persona 5

If a piece targets multiple personas, pick the primary and note the secondary. Write for the primary; check that nothing alienates the secondary.

---

## Data sources

- Bolt.new user survey: self-reported data across 10M+ users. Covers role, workplace type, use case, no-code experience, and acquisition channel. Segmented by persona.
- PM survey: N=126 product managers, April 2026 (Audience Panel — Collection 1). 80% at companies with 501+ employees. 82% daily AI tool users.
- Enterprise pain points and differentiators: aggregated from enterprise customer accounts and sales interactions, May 2026.
- Developer pain points: compiled from customer and prospect conversations across enterprise accounts (Workato, StoneX, EY, Porch, Cofense, Salesforce, Roku, and others), May 2026.
- Creative/marketer industry context: enterprise marketing, agency, and freelancer AI adoption research, 2026.
- Third-party research: `third-party-research.md` — see Reference files table for full description.
