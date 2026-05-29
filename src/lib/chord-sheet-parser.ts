import type { Section, Cell } from '@/types';

// Chord token regex: root + optional quality/extension + optional bass note
// Handles: Am, F#m7, Cmaj7, E7, Gsus4, Cadd9, G/B, Dm7, Cdim7, etc.
const CHORD_RE =
  /^[A-G][#b]?(?:m(?:aj)?(?:[0-9]+)?|min(?:[0-9]+)?|dim(?:[0-9]+)?|aug(?:[0-9]+)?|sus[24]?|[0-9]+)?(?:add[0-9]+)?(?:\/[A-G][#b]?)?$/;

function isChord(token: string): boolean {
  return CHORD_RE.test(token);
}

// A line is a chord line if ≥ 80 % of its tokens are valid chords and there's at least one
function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const n = tokens.filter(isChord).length;
  return n > 0 && n / tokens.length >= 0.8;
}

function extractChords(line: string): string[] {
  return line.trim().split(/\s+/).filter(isChord);
}

const SECTION_LABELS: Record<string, string> = {
  intro: 'Intro',
  verse: 'Couplet',
  chorus: 'Refrain',
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
  for (const [en, fr] of Object.entries(SECTION_LABELS)) {
    if (lower === en || lower.startsWith(en + ' ')) {
      const rest = content.slice(en.length).trim();
      return rest ? `${fr} ${rest}` : fr;
    }
  }
  return content;
}

type ValidSpan = 0.5 | 1 | 2 | 3 | 4;

function chordsToRows(chords: string[]): Cell[][] {
  const rows: Cell[][] = [];
  // Chunk into groups of max 4
  for (let i = 0; i < chords.length; i += 4) {
    const chunk = chords.slice(i, i + 4);
    let span: ValidSpan = 1;
    if (chunk.length === 1) span = 4;
    else if (chunk.length === 2) span = 2;
    rows.push(chunk.map(chord => ({ chord, span })));
  }
  return rows;
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

export function parseChordSheetText(text: string): ImportedSheet {
  const lines = text.split('\n');

  // Capo + YouTube URL : préférer la ligne qui contient les deux
  let capo: number | null = null;
  let referenceUrl: string | undefined;

  const capoWithUrl = text.match(/Capo\s+(\d+)[^\n]*(https?:\/\/\S+)/i);
  if (capoWithUrl) {
    capo = parseInt(capoWithUrl[1], 10);
    referenceUrl = capoWithUrl[2];
  } else {
    const capoOnly = text.match(/\bCapo\s+(\d+)\b/i);
    if (capoOnly) capo = parseInt(capoOnly[1], 10);
    const ytOnly = text.match(YT_RE);
    if (ytOnly) referenceUrl = ytOnly[0];
  }

  // Filter noise lines (page markers, URLs, standalone capo annotations)
  const useful = lines.filter(l => {
    const t = l.trim();
    if (!t) return false;
    if (/^Page \d+\/\d+/.test(t)) return false;
    if (/^https?:\/\//.test(t)) return false;
    return true;
  });

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

  for (const line of useful) {
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

  // Guess key from first chord of first section
  let key = '';
  const firstChord = sections[0]?.rows[0]?.[0]?.chord;
  if (firstChord) key = firstChord;

  return { title: '', artist: '', key, capo, referenceUrl, sections };
}
