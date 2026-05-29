import type { Section, Cell } from '@/types';

// Chord token regex — handles standard + jazz extensions + Bm7-5 / G7b5 / C#7#9 style
const CHORD_RE =
  /^[A-G][#b]?(?:m(?:aj)?(?:[0-9]+)?|min(?:[0-9]+)?|dim(?:[0-9]+)?|aug(?:[0-9]+)?|sus[24]?|[0-9]+)?(?:(?:[b#]|-)[0-9]+)*(?:add[0-9]+)?(?:\/[A-G][#b]?)?$/;

function isChord(token: string): boolean {
  return CHORD_RE.test(token.replace(/[()]/g, ''));
}

function isChordLine(line: string): boolean {
  const tokens = line.trim().replace(/\([xX]\d+\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const n = tokens.filter(t => isChord(t)).length;
  return n > 0 && n / tokens.length >= 0.8;
}

// ── Span inference from character positions ──────────────────────────────────

type ValidSpan = 0.5 | 1 | 2 | 3 | 4;

function snapSpan(beats: number): ValidSpan {
  const valid: ValidSpan[] = [0.5, 1, 2, 3, 4];
  return valid.reduce((prev, curr) =>
    Math.abs(curr - beats) < Math.abs(prev - beats) ? curr : prev
  );
}

function lineToRow(line: string, beatsPerMeasure: number): Cell[] {
  // Strip repeat markers "(x8)" before position analysis
  const clean = line.replace(/\s*\([xX]\d+\)\s*/g, '');

  // Find all chord tokens with their column position
  const found: { chord: string; col: number }[] = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const chord = m[0].replace(/[()]/g, '');
    if (isChord(chord)) found.push({ chord, col: m.index });
  }

  if (found.length === 0) return [];

  // Single chord → full measure
  if (found.length === 1) {
    return [{ chord: found[0].chord, span: beatsPerMeasure as ValidSpan }];
  }

  // For long lines (5+ chords) use flat span=1, caller will chunk
  if (found.length > 4) {
    return found.map(f => ({ chord: f.chord, span: 1 as ValidSpan }));
  }

  // 2–4 chords: infer spans from column gaps
  const gaps: number[] = found.slice(0, -1).map((f, i) => found[i + 1].col - f.col);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  gaps.push(avgGap); // estimate last chord's hold

  const total = gaps.reduce((a, b) => a + b, 0);
  const spans: ValidSpan[] = gaps.map(g => snapSpan((g / total) * beatsPerMeasure));

  // Correct sum to equal beatsPerMeasure
  const sum = spans.reduce((a, b) => a + b, 0);
  if (sum !== beatsPerMeasure) {
    spans[spans.length - 1] = snapSpan(spans[spans.length - 1] + (beatsPerMeasure - sum));
  }

  return found.map((f, i) => ({ chord: f.chord, span: spans[i] }));
}

// ── Section label translation ─────────────────────────────────────────────────

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

// ── Noise filter ──────────────────────────────────────────────────────────────

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^Page \d+\/\d+/.test(t)) return true;
  if (/^https?:\/\//.test(t)) return true;
  // Guitar / bass tab lines: e|---, B|---, etc.
  if (/^[eEBGDAd]\|/.test(t)) return true;
  // French/English metadata headers
  if (/^(Difficulté|Accordage|Tonalité|Accord\s*s?|Schéma de Strumming|Whole Song|Tuning|Key|Difficulty)\s*:?/i.test(t)) return true;
  // BPM lines
  if (/\bbpm\b/i.test(t)) return true;
  // Strumming beat markers: lines made of digits, "&", spaces only
  if (/^[\d& ]+$/.test(t)) return true;
  // Standalone capo annotations
  if (/^[Cc]apodastre\s*:?\s*\d/i.test(t) && t.length < 60) return true;
  if (/^[Cc]apo\s+\d/i.test(t) && t.length < 60) return true;
  // "no capo" annotation
  if (/^no\s+capo/i.test(t)) return true;
  return false;
}

// ── Metadata extraction ───────────────────────────────────────────────────────

const YT_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s]*v=|youtu\.be\/)[\w-]+(?:[^\s]*)?/;

function extractTitleArtist(lines: string[]): { title: string; artist: string } {
  const firstLine = lines.find(l => {
    const t = l.trim();
    return t && !t.startsWith('http');
  })?.trim() ?? '';

  // "Le Sud Accords par Nino Ferrer" / "Crazy Chords by Gnarls Barkley"
  const acMatch = firstLine.match(/^(.+?)\s+[Aa]ccords?\s+(?:par|by)\s+(.+)$/i);
  if (acMatch) return { title: acMatch[1].trim(), artist: acMatch[2].trim() };

  // "Title - Artist" or "Title – Artist"
  const dashMatch = firstLine.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (dashMatch) return { title: dashMatch[1].trim(), artist: dashMatch[2].trim() };

  return { title: '', artist: '' };
}

function extractCapo(text: string): number | null {
  const frMatch = text.match(/[Cc]apodastre\s*:?\s*(\d+)/);
  if (frMatch) return parseInt(frMatch[1], 10);
  const enMatch = text.match(/\b[Cc]apo\s*:?\s*(\d+)/);
  if (enMatch) return parseInt(enMatch[1], 10);
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ImportedSheet {
  title: string;
  artist: string;
  key: string;
  capo: number | null;
  referenceUrl?: string;
  sections: Section[];
}

export function parseChordSheetText(text: string): ImportedSheet {
  const lines = text.split('\n');

  const { title, artist } = extractTitleArtist(lines);
  const capo = extractCapo(text);

  // YouTube URL: prefer the line that also has the detected capo number
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

  // Key: explicit "Tonalité/Key: X" first, else first chord of first section
  const keyMeta = text.match(/(?:Tonalité|Key)\s*:?\s*([A-G][#b]?m?)/i);
  let key = keyMeta ? keyMeta[1] : '';

  // ── Section parsing ───────────────────────────────────────────────────────

  const sections: Section[] = [];
  let sectionIdx = 0;
  let currentLabel: string | null = null;
  let currentRows: Cell[][] = [];

  const flushSection = () => {
    if (currentLabel !== null && currentRows.length > 0) {
      sections.push({
        id: `section-import-${sectionIdx++}`,
        label: currentLabel,
        repeat: 1,
        beatsPerMeasure: 4,
        rows: currentRows,
      });
    }
    currentRows = [];
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
      const row = lineToRow(line, 4);
      if (row.length === 0) continue;

      if (row.length <= 4) {
        currentRows.push(row);
      } else {
        // Long line: chunk into rows of 4 with span=1
        for (let i = 0; i < row.length; i += 4) {
          currentRows.push(
            row.slice(i, i + 4).map(c => ({ chord: c.chord, span: 1 as ValidSpan }))
          );
        }
      }
    }
  }
  flushSection();

  if (!key && sections.length > 0) {
    key = sections[0]?.rows[0]?.[0]?.chord ?? '';
  }

  return { title, artist, key, capo, referenceUrl, sections };
}
