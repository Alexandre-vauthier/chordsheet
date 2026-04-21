import type { Section, Difficulty } from '@/types';

// Suffixes considérés comme avancés (extensions, altérations)
const ADVANCED_PATTERN = /dim|aug|m7b5|mMaj|ø|°|\+|b5|#5|b9|#9|#11|b13|11|13/i;

// Suffixes intermédiaires (septièmes, sus, add)
const INTERMEDIATE_PATTERN = /maj7|maj9|m7|m9|7|9|sus|add/i;

function chordComplexity(name: string): 'basic' | 'intermediate' | 'advanced' {
  // Retirer la racine (ex: "Cm7b5" → "m7b5", "F#maj7" → "maj7")
  const suffix = name.replace(/^[A-G][b#]?/, '');
  if (!suffix || suffix === 'm') return 'basic';
  if (ADVANCED_PATTERN.test(suffix)) return 'advanced';
  if (INTERMEDIATE_PATTERN.test(suffix)) return 'intermediate';
  return 'basic';
}

export function computeDifficulty(sections: Section[]): Difficulty {
  const seen = new Set<string>();
  let advancedCount = 0;
  let intermediateCount = 0;

  for (const section of sections) {
    for (const row of section.rows) {
      for (const cell of row) {
        const chord = cell.chord.trim();
        if (!chord) continue;
        // Ignorer la note de basse (ex: "G/B" → analyser "G")
        const root = chord.split('/')[0];
        const key = root.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const complexity = chordComplexity(root);
        if (complexity === 'advanced') advancedCount++;
        else if (complexity === 'intermediate') intermediateCount++;
      }
    }
  }

  const unique = seen.size;

  // Avancé : ≥ 10 accords uniques, OU au moins 1 accord avancé
  if (unique >= 10 || advancedCount >= 1) return 3;

  // Intermédiaire : 6–9 accords uniques, OU au moins 2 accords intermédiaires
  if (unique >= 6 || intermediateCount >= 2) return 2;

  // Facile
  return 1;
}
