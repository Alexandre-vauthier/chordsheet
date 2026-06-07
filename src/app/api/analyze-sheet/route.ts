import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Tu es un musicien expérimenté et rigoureux qui déchiffre une partition. Les images fournies sont les pages successives d'un même morceau, dans l'ordre. Prends le temps d'analyser chaque mesure attentivement avant de répondre.

RÈGLES DE DÉCHIFFRAGE :

1. SECTIONS : Identifie et nomme chaque section dans la langue de la partition (Intro, Verse/Couplet, Pre-Chorus, Chorus/Refrain, Bridge/Pont, Solo, Outro, Coda…). Si aucun nom n'est indiqué, numérote (Section 1, Section 2…).

2. REPRISES (||: :||) : Ne duplique pas les mesures. Utilise "repeat" pour le nombre de fois joué (repeat: 2 pour une reprise simple).

3. PREMIÈRE ET DEUXIÈME FOIS (volta brackets 1. 2.) : Crée deux sections distinctes.

4. DA CAPO AL FINE / DAL SEGNO AL CODA : Reconstitue l'ordre de lecture réel sans dupliquer.

5. DURÉES DES ACCORDS :
   Chaque accord est un objet {"chord": "...", "beats": N} où beats = nombre de TEMPS que dure l'accord.
   - En 4/4 : une mesure = 4 temps. Accord sur toute la mesure → beats:4. Deux accords par mesure à parts égales → beats:2 chacun. Quatre accords → beats:1 chacun.
   - En 3/4 : une mesure = 3 temps. Accord sur toute la mesure → beats:3. Deux accords → beats:2 puis beats:1 (ou autre répartition réelle).
   - Si un accord dure plusieurs mesures, exprime la durée totale en temps (ex: 2 mesures de 4/4 = beats:8).
   - Mesure vide ou silence : {"chord": "", "beats": 4} (ou le nombre de temps réel).

6. FORMAT DES ACCORDS — RÈGLE ABSOLUE :
   - Chaque accord DOIT commencer par une note racine : A, B, C, D, E, F ou G (majuscule), éventuellement suivie de # ou b.
   - Exemples VALIDES : C, Am, G7, Fmaj7, Bb, F#m, Dm7, Cmaj7, E7, Abmaj7, Bm7b5
   - Exemples INVALIDES (interdits) : m7, maj7, m, 7, dim, sus4 — ces formes sans racine sont des erreurs.
   - Si tu ne peux pas identifier la racine, utilise {"chord": "", "beats": N}.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour :
{
  "title": "titre si visible sinon chaîne vide",
  "artist": "artiste si visible sinon chaîne vide",
  "key": "tonalité (ex: Am, G, Bb) si déductible sinon chaîne vide",
  "timeSignature": "4/4 ou 3/4 ou autre si visible, sinon 4/4",
  "tempo": "valeur numérique BPM si visible sinon chaîne vide",
  "sections": [
    {
      "label": "Intro",
      "repeat": 1,
      "chords": [
        {"chord": "Am", "beats": 4},
        {"chord": "G", "beats": 4}
      ]
    },
    {
      "label": "Verse",
      "repeat": 2,
      "chords": [
        {"chord": "Am", "beats": 2},
        {"chord": "G", "beats": 2},
        {"chord": "C", "beats": 4},
        {"chord": "F", "beats": 2},
        {"chord": "E7", "beats": 2}
      ]
    }
  ]
}`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => null);
    const files: { data: string; type: string }[] = body?.files ?? [];
    if (!files.length) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Format non supporté : ${file.type}. Utilise JPG, PNG ou WebP.` }, { status: 400 });
      }
    }

    const imageContents = files.map((file) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: file.data,
      },
    }));

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Normaliser et filtrer les accords
    const validRoot = /^[A-G][#b]?/;
    if (Array.isArray(parsed.sections)) {
      for (const section of parsed.sections) {
        if (Array.isArray(section.chords)) {
          section.chords = section.chords.map((c: unknown) => {
            // Compatibilité si Claude renvoie encore des strings
            if (typeof c === 'string') return { chord: validRoot.test(c) ? c : '', beats: parsed.timeSignature?.startsWith('3') ? 3 : 4 };
            const obj = c as { chord?: string; beats?: number };
            const chord = typeof obj.chord === 'string' && (obj.chord === '' || validRoot.test(obj.chord)) ? obj.chord : '';
            const beats = typeof obj.beats === 'number' && obj.beats > 0 ? obj.beats : (parsed.timeSignature?.startsWith('3') ? 3 : 4);
            return { chord, beats };
          });
        }
      }
    }

    return NextResponse.json(parsed);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'Impossible de parser la réponse du modèle.' }, { status: 500 });
    }
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
