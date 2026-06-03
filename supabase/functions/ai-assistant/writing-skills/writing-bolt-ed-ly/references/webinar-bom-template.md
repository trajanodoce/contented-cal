# Webinar Bill of Materials (BOM) Template

A production checklist and content template for Bolt.new webinars. Covers everything from planning through post-event content. Work through each section in order — skip what doesn't apply.

Based on the Notion Editorial Calendar template used for HustleFund, Storybook/Bolt, and other Bolt.new webinars.

---

## Export to Notion

When the user is ready to export, create a new page directly in the Editorial Calendar database using the `notion-create-pages` tool.

**Parent data source:** `collection://9ef5052b-a5cb-4c36-b8cc-049dcdcd73b7` (Editorial Calendar)

**Properties to set from intake:**
- `Content Title` — webinar title
- `Content Type` — "Webina/Livestream"
- `Request Type` — "Event"
- `Due Date` — webinar date
- `Requestor` — tag the user
- `Status` — "📅 Scheduled"
- `Funnel Stage` — from intake (TOFU / MOFU / BOFU)
- `Persona` — from intake
- `Campaign Type` — from intake (Thought Leadership, Product Education, etc.)
- `Priority` — ask if not specified

**Page content:** Render the filled-in BOM below as Notion-flavored Markdown. Use:
- Toggle headings (`{toggle="true"}`) for collapsible sections (Content Review Checklist, Partner Details, SEO & GEO — matching the existing Editorial Calendar template structure)
- Checkboxes (`- [ ]`) for all checklist items
- Tables for the content BOM tracker and timeline
- Date fields rendered as `@2026-06-15` inline mentions where dates have been filled in

Fetch the Notion enhanced-markdown-spec resource (`notion://docs/enhanced-markdown-spec`) before building the page content to ensure correct syntax.

---

## Event details

Fill these in first. Everything else flows from them.

- **Webinar title:**
- **Date and time:** (include timezone)
- **Duration:** (default: 45 min + 15 min Q&A)
- **Format:** (live demo, panel, fireside chat, workshop, AMA)
- **Platform:** (Luma, Zoom, StreamYard, etc.)
- **Recording plan:** (live only, recorded for replay, both)

### Speakers and roles

| Role | Name | Company | Bio needed? | Headshot needed? |
|------|------|---------|-------------|-----------------|
| Host / moderator | | | | |
| Speaker 1 | | | | |
| Speaker 2 | | | | |
| Guest / partner | | | | |

### Partner details

If co-hosted or co-marketed with a partner:

- **Partner company:**
- **Co-marketing goals:** (what both sides want out of this)
- **Partner goals:** (what the partner specifically needs — leads, brand exposure, product demo)
- **Partner deliverables:** (what they're providing — speaker, audience, promotion, content)
- **Approval process:** (who signs off on what, and by when)

---

## Audience and positioning

- **Target persona:** (small business owner, enterprise buyer, product manager, professional developer, general reader)
- **Funnel stage:** (TOFU / MOFU / BOFU)
- **Campaign type:** (thought leadership, product education, customer showcase, partner co-marketing)
- **What the audience gets out of it:** (be specific — not "learn about AI" but "see how to build a working site in 30 minutes")
- **Why they should care enough to register:** (the hook — what makes this worth an hour of their day)

---

## Content BOM

Every webinar generates multiple content assets. Check off what's needed and track status. Date fields are blank by default — fill in as dates are confirmed.

### Pre-event content

| Asset | Owner | Due date | Status | Notes |
|-------|-------|----------|--------|-------|
| Landing page / Luma description | | | | |
| Registration confirmation email | | | | |
| Reminder email (24 hours before) | | | | |
| Reminder email (1 hour before) | | | | |
| Email invite to existing list | | | | |
| Social: Eric Simons LinkedIn announcement | | | | |
| Social: Eric Simons X announcement | | | | |
| Social: Brand LinkedIn announcement | | | | |
| Social: Brand X announcement | | | | |
| Social: LinkedIn reminder (day of) | | | | |
| Social: X reminder (day of) | | | | |
| Partner cross-promotion posts | | | | |
| Slide deck / visual assets | | | | |
| Speaker prep doc / talking points | | | | |
| Demo script (if live demo) | | | | |

### Day-of content

| Asset | Owner | Due date | Status | Notes |
|-------|-------|----------|--------|-------|
| Opening script / host intro | | | | |
| Q&A moderation plan | | | | |
| Live social posts during event | | | | |
| CTA slide / closing offer | | | | |

### Post-event content

| Asset | Owner | Due date | Status | Notes |
|-------|-------|----------|--------|-------|
| Recording upload and hosting | | | | |
| Follow-up email (attendees) | | | | |
| Follow-up email (no-shows + recording link) | | | | |
| Social: Eric Simons recap (LinkedIn) | | | | |
| Social: Eric Simons recap (X) | | | | |
| Social: Brand recap (LinkedIn) | | | | |
| Social: Brand recap (X) | | | | |
| Blog recap or writeup | | | | |
| Short video clips from recording | | | | |
| Quote cards from speakers | | | | |
| Slide deck share (if applicable) | | | | |

---

## Copy templates

### Landing page / Luma description

Structure:
1. **Hook** — one sentence on why this matters right now
2. **What you'll learn** — three to four bullet points, outcome-oriented
3. **Who this is for** — one sentence targeting the persona
4. **Speaker bios** — two to three sentences each, credibility-focused
5. **CTA** — register button with specific language ("Save your spot" not "Submit")

### Email invite

- **Subject line:** specific and benefit-led. No "Join us for a webinar" — say what they'll get.
- **Body:** hook → what they'll learn (bullets) → speaker credibility → date/time → CTA
- **CTA:** single, clear ("Register now" or "Save your spot")

### Reminder emails

- **24-hour reminder:** restate the hook + logistics (date, time, link). Keep it short.
- **1-hour reminder:** just the link and a one-liner. "Starting in an hour — here's your link."

### Follow-up emails

- **Attendees:** thank you → key takeaway → recording link → CTA (try Bolt.new, book a demo, etc.)
- **No-shows:** no guilt trip. "Here's what you missed" → recording link → same CTA

---

## Social promotion

### Voice

All webinar content — including brand social posts — uses the standard Bolt.new TOV from bolt-TOV-and-guidelines.

**Exception:** Social posts attributed to Eric Simons use his tone profile. Read `/Users/taylor/.claude/skills/bolter-tones/references/eric-simons-tone.md` before drafting his posts. Apply his voice on top of the Bolt.new editorial guidelines. This applies only to Eric's social posts, not to landing pages, emails, or other webinar content.

### LinkedIn posts

Draft three posts minimum per account (Eric Simons + brand):
1. **Announcement** (one to two weeks before) — what the webinar covers and why it matters
2. **Reminder** (day of or day before) — shorter, urgency-focused, link to register
3. **Recap** (day after) — key takeaway, link to recording

Target 800-1,300 characters. Professional with a sense of humor.

### X posts

Draft three posts minimum per account (Eric Simons + brand):
1. **Announcement** — hook + link. Target ~250 characters.
2. **Day-of reminder** — "Starting in [time]" + link
3. **Recap / highlight** — one standout moment or quote + link to recording

Brevity first. More room for personality than LinkedIn.

---

## SEO and GEO

If the webinar generates a blog recap or landing page that will live on bolt.new:

### SEO
- **Primary keyword:**
- **Secondary keywords:**
- **Search intent:** (informational / navigational / commercial / transactional)
- **Target SERP feature:** (featured snippet / people also ask / image pack / etc.)
- **Slug / URL:**
- **Meta title:**
- **Meta description:**
- **Internal links to include:**
- **External references:**

### GEO (Generative Engine Optimization)
- **Target AI platforms:** (ChatGPT / Perplexity / Google AI Overview / etc.)
- **Entity coverage:** (what brand, product, or concept should this content reinforce?)
- **Citation-worthy claims:** (stats, quotes, or definitions that should be clearly attributable)
- **Structured answer blocks:** (FAQ-style sections or direct answers to include)

---

## Content review checklist

### Writer self-review
- [ ] All copy is complete and on-brief
- [ ] Facts and claims verified
- [ ] Internal links added where applicable
- [ ] SEO / GEO elements incorporated (if web-published)
- [ ] Bolt.new TOV applied to all content (landing page, emails, brand social, slides, recap)
- [ ] Eric Simons tone applied to his social posts only

### Editor review
- [ ] Tone and voice on-brand
- [ ] Legal / compliance check (if needed)
- [ ] Final copy approved

### SME review
- [ ] Product specs and demo claims accurate
- [ ] Speaker bios and titles correct
- [ ] Approved

**Reviewer notes:**

---

## Timeline

| Milestone | Target date | Owner | Complete |
|-----------|------------|-------|----------|
| Event details locked | | | - [ ] |
| Speaker prep doc complete | | | - [ ] |
| Landing page live | | | - [ ] |
| First email invite sent | | | - [ ] |
| Social announcements posted | | | - [ ] |
| Slide deck finalized | | | - [ ] |
| Reminder emails scheduled | | | - [ ] |
| Webinar day | | | - [ ] |
| Recording uploaded | | | - [ ] |
| Follow-up emails sent | | | - [ ] |
| Social recaps posted | | | - [ ] |
| Blog recap published | | | - [ ] |

---

## Notion export

After drafting all webinar content, offer to create the webinar as a page in the Editorial Calendar.

**How to export:**
1. Use `notion-create-pages` with parent data source `collection://9ef5052b-a5cb-4c36-b8cc-049dcdcd73b7`.
2. Set properties from intake: Content Title, Content Type, Due Date, Status, Funnel Stage, Persona, Campaign Type.
3. Render the filled-in BOM as page content using Notion-flavored Markdown — toggle headings for collapsible sections, checkboxes for checklists, tables for the content tracker, and `@YYYY-MM-DD` date mentions for all filled-in dates.
4. Fetch `notion://docs/enhanced-markdown-spec` before building the page to ensure correct syntax.
