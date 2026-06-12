// Display labels for external-link platforms, used in card-indicator
// tooltips (the Paperclip "N attachments: Figma · Canva …" hover).
//
// Single source of truth so every surface — Board, List, Calendar,
// Project detail — enumerates platforms identically. Previously this lived
// as a local `LINK_PLATFORM_META` in BoardPage and only that one surface
// showed the breakdown; the others just said "N attachments". Extracted
// 2026-06-11 alongside the shared CardIndicators component.
//
// Note: this is intentionally a lightweight label-only map. The richer
// chip-rendering meta (bg/text colors + icon glyphs) still lives in
// ExternalLinks.tsx `PLATFORM_META` — different concern (chip styling vs
// tooltip text), so the two don't conflict.

export const LINK_PLATFORM_LABELS: Record<string, string> = {
  ordinal: 'Ordinal',
  figma: 'Figma',
  canva: 'Canva',
  miro: 'Miro',
  google_docs: 'Google Docs',
  google_drive: 'Google Drive',
  notion: 'Notion',
  linear: 'Linear',
  granola: 'Granola',
  file: 'File',
  other: 'Link',
};
