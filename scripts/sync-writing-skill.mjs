#!/usr/bin/env node
/**
 * Sync the bolt-writing-skills content into the ai-assistant edge function.
 *
 * Reads from ~/Documents/skills/bolt-writing-skills/ and stamps the relevant
 * SKILL.md and reference files into a generated TypeScript module that the
 * edge function imports. Re-run this script after updating any skill file
 * so the deployed system prompt stays in sync.
 *
 * Usage:
 *   node scripts/sync-writing-skill.mjs
 *
 * Then deploy the function via Supabase MCP (deploy_edge_function with both
 * index.ts and skill-content.ts in the files array).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(homedir(), 'Documents/skills/bolt-writing-skills');
const OUT_PATH = join(
  __dirname,
  '..',
  'supabase/functions/ai-assistant/skill-content.ts',
);

function read(rel) {
  const path = join(SKILLS_DIR, rel);
  if (!existsSync(path)) {
    throw new Error(`Missing skill file: ${rel}\n  expected at: ${path}`);
  }
  return readFileSync(path, 'utf-8').trim();
}

// ── Read every skill file we care about ────────────────────────────────────

const tovGuide = read('bolt-TOV-and-guidelines/SKILL.md');
const banned = read('bolt-TOV-and-guidelines/references/banned.md');
const structures = read('bolt-TOV-and-guidelines/references/structures.md');

const orchestrator = read('writing-bolt-ed-ly/SKILL.md');
const schwartzMatrix = read('writing-bolt-ed-ly/references/schwartz-5x5-matrix.md');

const personas = read('bolt-buyer-personas/SKILL.md');
const tonesIndex = read('bolter-tones/SKILL.md');

const voiceProfiles = {
  'Eric Simons': read('bolter-tones/references/eric-simons-tone.md'),
  'Alexander Berger': read('bolter-tones/references/alexander-berger-tone.md'),
  'Dominic Elm': read('bolter-tones/references/dominic-elm-tone.md'),
  'Garrett Serviss': read('bolter-tones/references/garrett-serviss-tone.md'),
  'Donald Savard': read('bolter-tones/references/donald-savard-tone.md'),
  'Gary Ballabio': read('bolter-tones/references/gary-ballabio-tone.md'),
};

// ── Generate output ────────────────────────────────────────────────────────

const stamp = new Date().toISOString().split('T')[0];
const totalChars =
  tovGuide.length +
  banned.length +
  structures.length +
  orchestrator.length +
  schwartzMatrix.length +
  personas.length +
  tonesIndex.length +
  Object.values(voiceProfiles).reduce((a, b) => a + b.length, 0);

const banner = `// ============================================================================
// AUTO-GENERATED FROM ~/Documents/skills/bolt-writing-skills
// ============================================================================
// DO NOT EDIT BY HAND. Run \`node scripts/sync-writing-skill.mjs\` to regenerate
// after updating any skill file. Updated content takes effect on next
// edge-function deploy.
//
// Last sync: ${stamp}
// Total content: ~${Math.round(totalChars / 1024)}KB across ${
  6 + Object.keys(voiceProfiles).length
} source files
// ============================================================================
`;

const out = `${banner}
/** \`bolt-TOV-and-guidelines/SKILL.md\` — tone of voice + editorial rules + Stop Slop filter (full). */
export const TOV_GUIDE = ${JSON.stringify(tovGuide)};

/** \`bolt-TOV-and-guidelines/references/banned.md\` — full banned-phrase catalog. */
export const BANNED_PHRASES = ${JSON.stringify(banned)};

/** \`bolt-TOV-and-guidelines/references/structures.md\` — structures to avoid catalog. */
export const STRUCTURES_TO_AVOID = ${JSON.stringify(structures)};

/** \`writing-bolt-ed-ly/SKILL.md\` — the orchestrator (workflow rules, content-type routing). */
export const ORCHESTRATOR_SKILL = ${JSON.stringify(orchestrator)};

/** \`writing-bolt-ed-ly/references/schwartz-5x5-matrix.md\` — full Schwartz framework. */
export const SCHWARTZ_MATRIX = ${JSON.stringify(schwartzMatrix)};

/** \`bolt-buyer-personas/SKILL.md\` — all six persona profiles in one library. */
export const PERSONA_LIBRARY = ${JSON.stringify(personas)};

/** \`bolter-tones/SKILL.md\` — voice index pointing at the per-person tone files. */
export const TONES_INDEX = ${JSON.stringify(tonesIndex)};

/** Map of person name → full \`bolter-tones/references/<person>-tone.md\` content. */
export const VOICE_PROFILES: Record<string, string> = ${JSON.stringify(
  voiceProfiles,
  null,
  2,
)};
`;

writeFileSync(OUT_PATH, out);

console.log(`✓ Generated ${OUT_PATH}`);
console.log(`  Last sync: ${stamp}`);
console.log(`  Content size: ~${Math.round(totalChars / 1024)}KB`);
console.log(`  Voices: ${Object.keys(voiceProfiles).join(', ')}`);
console.log('\nNext: redeploy the ai-assistant edge function so the new content takes effect.');
