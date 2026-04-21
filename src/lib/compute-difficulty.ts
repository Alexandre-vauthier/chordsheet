import type { Section, Difficulty } from '@/types';

function chordComplexity(name: string): 'basic' | 'intermediate' | 'advanced' {
  // Retirer la racine (ex: "Cm7b5" → "m7b5", "F#maj7" → "maj7", "Dsus4" → "sus4")
  const suffix = name.replace(/^[A-G][b#]?/, '');
  if (!suffix || suffix === 'm') return 'basic';

  // Avancé : altérations, diminués, augmentés, extensions ≥ 11
  if (/dim|aug|m7b5|mMaj|ø|°|\+|b5|#5|b9|#9|#11|b13|\b11\b|\b13\b/.test(suffix)) return 'advanced';

  // Intermédiaire : septièmes et neuvièmes (vraie harmonie jazz/pop)
  // sus, add, 7sus restent basiques — courants chez les débutants
  if (/7sus|sus|add/.test(suffix)) return 'basic';
  if (/maj7|maj9|m7|m9|^7$|^7[^0-9]|[^a-z]7$|[^a-z]7[^0-9]|^9$/.test(suffix)) return 'intermediate';

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

  // Avancé : au moins 1 accord avancé (dim, aug, m7b5, extensions…)
  if (advancedCount >= 1) return 3;

  // Intermédiaire : au moins 2 accords intermédiaires (7e, maj7…)
  //                 OU vraiment beaucoup d'accords basiques (≥ 10)
  if (intermediateCount >= 2 || unique >= 10) return 2;

  // Facile : que des accords basiques, peu importe le nombre
  return 1;
}
