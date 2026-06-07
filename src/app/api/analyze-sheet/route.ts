import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Tu es un expert en lecture de partitions musicales.

Analyse cette image de partition et extrais tous les symboles d'accords visibles (Am, G7, Cmaj7, F#m, etc.) dans l'ordre d'apparition.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour :
{
  "title": "titre si visible sinon chaîne vide",
  "artist": "artiste si visible sinon chaîne vide",
  "key": "tonalité si déductible (ex: Am, G) sinon chaîne vide",
  "timeSignature": "4/4 ou 3/4 ou autre si visible, sinon 4/4",
  "tempo": "BPM si visible sinon chaîne vide",
  "sections": [
    {
      "label": "nom de la section si indiqué (Intro, Verse, Chorus...) sinon Section 1",
      "chords": ["Am", "G", "C", "G"]
    }
  ]
}

Règles :
- Chaque élément du tableau chords = un accord pour une mesure entière
- Si un accord dure plusieurs mesures, répète-le autant de fois
- Si plusieurs sections sont clairement délimitées, crée plusieurs objets dans sections
- Si aucune section n'est indiquée, mets tout dans une seule section "Section 1"
- Ignore les notes individuelles, ne garde que les symboles d'accords`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Format non supporté. Utilise JPG, PNG ou WebP.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    // Nettoyer le JSON si Claude a quand même ajouté des backticks
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
