import type { Section, Cell } from '@/types';

// Chord token regex: root + optional quality/extension + optional bass note
// Handles: Am, F#m7, Cmaj7, E7, Gsus4, Cadd9, G/B, Dm7, Cdim7, Am/G, Am/F#, etc.
const CHORD_RE =
  /^[A-G][#b]?(?:m(?:aj)?(?:[0-9]+)?|min(?:[0-9]+)?|dim(?:[0-9]+)?|aug(?:[0-9]+)?|sus[24]?|[0-9]+)?(?:add[0-9]+)?(?:\/[A-G][#b]?)?$/;

function isChord(token: string): boolean {
  // Strip parentheses e.g. "(C)" → "C"
  return CHORD_RE.test(token.replace(/[()]/g, ''));
}

// A line is a chord line if ≥ 80 % of its tokens are valid chords and there's at least one
function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const n = tokens.filter(isChord).length;
  return n > 0 && n / tokens.length >= 0.8;
}

function extractChords(line: string): string[] {
  return line
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/[()]/g, ''))
    .filter(isChord);
}

const SECTION_LABELS: Record<string, string> = {
  intro: 'Intro',
  verse: 'Couplet',
  couplet: 'Couplet',
  chorus: 'Refrain',
  refrain: 'Refrain',
  'pre-chorus': 'Pré-refrain',
  bridge: 'Bridge',
  outro: 'Outro',
  solo: 'Solo',
  interlude: 'Interlude',
  instrumental: 'Instrumental',
  hook: 'Hook',
};

function translateLabel(raw: string): string {
  const content = raw.replace(/^\[|\]$/g, '').trim();
  const lower = content.toLowerCase();
  for (const [key, fr] of Object.entries(SECTION_LABELS)) {
    if (lower === key || lower.startsWith(key + ' ')) {
      const rest = content.slice(key.length).trim();
      return rest ? `${fr} ${rest}` : fr;
    }
  }
  return content;
}

type ValidSpan = 0.5 | 1 | 2 | 3 | 4;

function chordsToRows(chords: string[]): Cell[][] {
  const rows: Cell[][] = [];
  for (let i = 0; i < chords.length; i += 4) {
    const chunk = chords.slice(i, i + 4);
    let span: ValidSpan = 1;
    if (chunk.length === 1) span = 4;
    else if (chunk.length === 2) span = 2;
    rows.push(chunk.map(chord => ({ chord, span })));
  }
  return rows;
}

// Lines to discard regardless of position
function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^Page \d+\/\d+/.test(t)) return true;
  if (/^https?:\/\//.test(t)) return true;
  // Guitar tab lines: e|---, B|---, G|---, D|---, A|---, E|---
  if (/^[eEBGDAd]\|/.test(t)) return true;
  // French metadata headers
  if (/^(Difficulté|Accordage|Accord\s*s?|Schéma de Strumming|Whole Song)\s*:?/i.test(t)) return true;
  // Strumming beat markers: lines made of digits, "&", spaces only
  if (/^[\d& ]+$/.test(t)) return true;
  // Capodastre / Capo standalone annotation lines (no section content)
  if (/^[Cc]apodastre\s*:?\s*\d/i.test(t) && t.length < 60) return true;
  if (/^[Cc]apo\s+\d/i.test(t) && t.length < 60) return true;
  return false;
}

export interface ImportedSheet {
  title: string;
  artist: string;
  key: string;
  capo: number | null;
  referenceUrl?: string;
  sections: Section[];
}

const YT_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s]*v=|youtu\.be\/)[\w-]+(?:[^\s]*)?/;

function extractTitleArtist(lines: string[]): { title: string; artist: string } {
  // Look only at the first non-empty, non-URL line
  const firstLine = lines.find(l => {
    const t = l.trim();
    return t && !t.startsWith('http');
  })?.trim() ?? '';

  // "Le Sud Accords par Nino Ferrer" / "Hallelujah Chords by Leonard Cohen"
  const acMatch = firstLine.match(/^(.+?)\s+[Aa]ccords?\s+(?:par|by)\s+(.+)$/i);
  if (acMatch) return { title: acMatch[1].trim(), artist: acMatch[2].trim() };

  // "Title - Artist" or "Title – Artist"
  const dashMatch = firstLine.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (dashMatch) return { title: dashMatch[1].trim(), artist: dashMatch[2].trim() };

  return { title: '', artist: '' };
}

function extractCapo(text: string): number | null {
  // French: "Capodastre: 4e frette" / "Capodastre 4"
  const frMatch = text.match(/[Cc]apodastre\s*:?\s*(\d+)/);
  if (frMatch) return parseInt(frMatch[1], 10);
  // English: "Capo 1" / "capo: 2"
  const enMatch = text.match(/\b[Cc]apo\s*:?\s*(\d+)/);
  if (enMatch) return parseInt(enMatch[1], 10);
  return null;
}

export function parseChordSheetText(text: string): ImportedSheet {
  const lines = text.split('\n');

  const { title, artist } = extractTitleArtist(lines);

  // Capo
  const capo = extractCapo(text);

  // YouTube URL: prefer line that also has the detected capo number
  let referenceUrl: string | undefined;
  if (capo !== null) {
    const capoLine = lines.find(l => new RegExp(`[Cc]apo(?:dastre)?\\s*:?\\s*${capo}`).test(l));
    const ytInCapoLine = capoLine?.match(YT_RE);
    if (ytInCapoLine) referenceUrl = ytInCapoLine[0];
  }
  if (!referenceUrl) {
    const ytAny = text.match(YT_RE);
    if (ytAny) referenceUrl = ytAny[0];
  }

  // Parse sections
  const sections: Section[] = [];
  let sectionIdx = 0;
  let currentLabel: string | null = null;
  let currentChords: string[] = [];

  const flushSection = () => {
    if (currentLabel !== null && currentChords.length > 0) {
      sections.push({
        id: `section-import-${sectionIdx++}`,
        label: currentLabel,
        repeat: 1,
        beatsPerMeasure: 4,
        rows: chordsToRows(currentChords),
      });
    }
    currentChords = [];
  };

  for (const line of lines) {
    if (isNoiseLine(line)) continue;

    const trimmed = line.trim();

    if (/^\[.+\]$/.test(trimmed)) {
      flushSection();
      currentLabel = translateLabel(trimmed);
      continue;
    }

    if (currentLabel === null) continue;

    if (isChordLine(line)) {
      currentChords.push(...extractChords(line));
    }
  }
  flushSection();

  const key = sections[0]?.rows[0]?.[0]?.chord ?? '';

  return { title, artist, key, capo, referenceUrl, sections };
}
