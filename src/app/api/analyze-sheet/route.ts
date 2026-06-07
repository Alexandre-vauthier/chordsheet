import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Tu es un musicien expérimenté qui déchiffre une partition. Les images fournies sont les pages successives d'un même morceau, dans l'ordre.

Analyse l'intégralité de la partition et reconstitue la structure complète du morceau telle qu'elle doit être jouée.

RÈGLES DE DÉCHIFFRAGE :

1. SECTIONS : Identifie et nomme chaque section dans la langue de la partition (Intro, Verse/Couplet, Pre-Chorus, Chorus/Refrain, Bridge/Pont, Solo, Outro, Coda…). Si aucun nom n'est indiqué, numérote (Section 1, Section 2…).

2. REPRISES (||: :||) : Ne duplique pas les mesures. Utilise le champ "repeat" pour indiquer le nombre de fois que la section est jouée (repeat: 2 pour une reprise simple, repeat: 3 si jouée 3 fois).

3. PREMIÈRE ET DEUXIÈME FOIS (volta brackets 1. 2.) : Crée deux sections distinctes — une pour la 1ère fois (avec son propre "repeat": 1), une pour la 2ème fois.

4. DA CAPO AL FINE (D.C. al Fine) : Reconstitue l'ordre de lecture final dans les sections, sans dupliquer. Mets "repeat": 1 sur la section répétée et arrête à Fine.

5. DAL SEGNO AL CODA (D.S. al Coda) : Repère le signe § et la coda ⊕, reconstitue l'ordre réel de lecture.

6. ACCORDS PAR MESURE : Chaque élément du tableau "chords" = un accord pour UNE mesure entière. Si un accord dure 2 mesures consécutives, répète-le 2 fois dans le tableau. Si 2 accords se partagent une mesure (ex: 2 temps chacun en 4/4), mets-les quand même comme 2 mesures séparées.

7. MESURES VIDES / SILENCES : Utilise une chaîne vide "" pour une mesure sans accord.

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
      "chords": ["Am", "G", "C", "G"]
    },
    {
      "label": "Verse",
      "repeat": 2,
      "chords": ["Am", "G", "C", "G", "Am", "F", "C", "E7"]
    }
  ]
}`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll('files[]') as File[];
    if (!files.length) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Format non supporté : ${file.name}. Utilise JPG, PNG ou WebP.` }, { status: 400 });
      }
    }

    // Construire le contenu multi-images
    const imageContents = await Promise.all(files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        },
      };
    }));

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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

    return NextResponse.json(parsed);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'Impossible de parser la réponse du modèle.' }, { status: 500 });
    }
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
