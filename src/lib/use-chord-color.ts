import { useAuth } from '@/lib/auth-context';

// Couleurs par note fondamentale (arc-en-ciel chromatique)
const ROOT_COLORS: Record<string, { base: string; light: string }> = {
  'C': { base: '#dc2626', light: '#fecaca' },  // Rouge
  'D': { base: '#ea580c', light: '#fed7aa' },  // Orange
  'E': { base: '#ca8a04', light: '#fef08a' },  // Jaune
  'F': { base: '#16a34a', light: '#bbf7d0' },  // Vert
  'G': { base: '#0891b2', light: '#a5f3fc' },  // Cyan
  'A': { base: '#2563eb', light: '#bfdbfe' },  // Bleu
  'B': { base: '#7c3aed', light: '#ddd6fe' },  // Violet
};

// Extraire la note fondamentale (sans altération) d'un nom d'accord
function getRootNote(chord: string): string | null {
  const match = chord.trim().match(/^([A-G])/);
  return match ? match[1] : null;
}

// Vérifier si l'accord est mineur ou altéré (pour variation de couleur)
function isMinorOrAltered(chord: string): boolean {
  const match = chord.trim().match(/^[A-G][b#]?(.*)/);
  if (!match) return false;
  const suffix = match[1];
  return /^m(?!aj)/i.test(suffix) || /dim|°/i.test(suffix);
}

export function getChordColor(chord: string): { border: string; bg: string } | null {
  if (!chord) return null;
  const root = getRootNote(chord);
  if (!root || !ROOT_COLORS[root]) return null;

  const colors = ROOT_COLORS[root];
  const altered = isMinorOrAltered(chord);

  return {
    border: altered ? colors.base + 'aa' : colors.base,
    bg: altered ? colors.light + '80' : colors.light,
  };
}

export function useChordColor() {
  const { user } = useAuth();
  const enabled = user?.chordColorCoding ?? false;

  return (chord: string) => {
    if (!enabled) return null;
    return getChordColor(chord);
  };
}
