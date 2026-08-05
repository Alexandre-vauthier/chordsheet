/**
 * Uniformise la casse des libellés de section déjà enregistrés.
 *
 * La normalisation est en place à la sauvegarde, mais elle ne touche que ce qu'on
 * réenregistre : les grilles existantes gardent leur casse d'origine tant que
 * personne ne les rouvre. Ce script rattrape l'existant, une fois.
 *
 * Il applique exactement la même règle que l'application (`normaliserLibelle`),
 * pour que les deux ne puissent pas diverger.
 *
 *   npx tsx tools/normaliser-libelles.mts            # montre ce qui changerait
 *   npx tsx tools/normaliser-libelles.mts --ecrire   # applique
 *
 * Les identifiants viennent de `gcloud auth print-access-token` : aucun secret
 * n'est stocké ici.
 */
import { execSync } from 'node:child_process';
import { normaliserLibelle } from '../src/lib/section-label';

const PROJET = 'chordsheet-d372a';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJET}/databases/(default)/documents`;
const ECRIRE = process.argv.includes('--ecrire');

const jeton = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const entetes = {
  Authorization: `Bearer ${jeton}`,
  'x-goog-user-project': PROJET,
  'Content-Type': 'application/json',
};

interface Valeur { stringValue?: string; mapValue?: { fields: Record<string, Valeur> }; arrayValue?: { values?: Valeur[] } }
interface Document { name: string; fields: Record<string, Valeur> }

async function toutesLesGrilles(): Promise<Document[]> {
  const out: Document[] = [];
  let page: string | undefined;
  do {
    const url = `${BASE}/sheets?pageSize=300${page ? `&pageToken=${page}` : ''}`;
    const rep = await fetch(url, { headers: entetes });
    if (!rep.ok) throw new Error(`lecture impossible : ${rep.status}`);
    const json = await rep.json() as { documents?: Document[]; nextPageToken?: string };
    out.push(...(json.documents ?? []));
    page = json.nextPageToken;
  } while (page);
  return out;
}

const grilles = await toutesLesGrilles();
let sections = 0;
const changements: string[] = [];
const aEcrire: Document[] = [];

for (const doc of grilles) {
  const valeurs = doc.fields.sections?.arrayValue?.values ?? [];
  let touchee = false;
  for (const v of valeurs) {
    const champ = v.mapValue?.fields?.label;
    if (!champ?.stringValue) continue;
    sections++;
    const neuf = normaliserLibelle(champ.stringValue);
    if (neuf !== champ.stringValue) {
      changements.push(`${champ.stringValue} → ${neuf}`);
      champ.stringValue = neuf;
      touchee = true;
    }
  }
  if (touchee) aEcrire.push(doc);
}

console.log(`${grilles.length} grilles, ${sections} sections`);
console.log(`${changements.length} libellés à corriger, dans ${aEcrire.length} grilles`);

if (!ECRIRE) {
  console.log('\n(essai à blanc — relancer avec --ecrire pour appliquer)');
  process.exit(0);
}

// Une grille à la fois : une écriture ratée n'emporte pas les autres, et le
// compte affiché reste vrai.
let ecrites = 0;
for (const doc of aEcrire) {
  const rep = await fetch(`https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=sections`, {
    method: 'PATCH',
    headers: entetes,
    body: JSON.stringify({ fields: { sections: doc.fields.sections } }),
  });
  if (rep.ok) ecrites++;
  else console.log(`  échec sur ${doc.name.split('/').pop()} : ${rep.status}`);
}
console.log(`${ecrites} grilles mises à jour`);
