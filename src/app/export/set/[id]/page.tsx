import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAndConsumeExportToken } from '@/lib/pdf-export-token';
import { fromFirestore, chordFromFirestore } from '@/lib/firestore-helpers';
import { libraryKey } from '@/lib/library-key';
import type { LibraryChord } from '@/lib/library-chords-context';
import { SheetViewer } from '@/components/sheet/sheet-viewer';
import { ExportProviders } from './export-providers';
import type { Sheet } from '@/types';

interface ExportSetPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

interface ExportData {
  sheets: Sheet[];
  overrides: [string, LibraryChord][];
  additions: LibraryChord[];
  printChordDiagrams: boolean;
  printMinimizeRepeatedSections: boolean;
}

type PrepareResult = { ok: true; data: ExportData } | { ok: false; error: string };

// Aucun JSX ici : uniquement des données ou un message d'erreur, pour respecter
// react-hooks/error-boundaries (le rendu se fait entièrement hors du try/catch).
async function prepareExport(setId: string, userId: string): Promise<PrepareResult> {
  try {
    const db = getAdminDb();

    const [setSnap, libraryChordsSnap, requesterSnap] = await Promise.all([
      db.collection('sets').doc(setId).get(),
      db.collection('library_chords').get(),
      db.collection('users').doc(userId).get(),
    ]);

    if (!setSnap.exists) {
      return { ok: false, error: 'Set introuvable.' };
    }

    const setData = setSnap.data()!;
    const sheetIds: string[] = setData.sheetIds || [];

    const sheetSnaps = await Promise.all(
      sheetIds.map((sheetId: string) => db.collection('sheets').doc(sheetId).get())
    );
    const sheets: Sheet[] = sheetSnaps
      .filter((snap) => snap.exists)
      .map((snap) => fromFirestore(snap.id, snap.data()!));

    // Reconstruire overrides/additions de la bibliothèque d'accords (même logique que
    // LibraryChordsProvider.reload(), mais via Admin SDK côté serveur)
    const overrides: [string, LibraryChord][] = [];
    const additions: LibraryChord[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    libraryChordsSnap.docs.forEach((d: any) => {
      const raw = d.data();
      const entry: LibraryChord = {
        docId: d.id,
        instrumentId: raw.instrumentId,
        isOverride: raw.isOverride,
        createdBy: raw.createdBy,
        chord: chordFromFirestore(raw.chord as Record<string, unknown>),
      };
      if (entry.isOverride) {
        overrides.push([libraryKey(entry.chord.name, entry.instrumentId), entry]);
      } else {
        additions.push(entry);
      }
    });

    const requesterData = requesterSnap.data();
    const printChordDiagrams = requesterData?.printChordDiagrams ?? false;
    const printMinimizeRepeatedSections = requesterData?.printMinimizeRepeatedSections ?? false;

    return { ok: true, data: { sheets, overrides, additions, printChordDiagrams, printMinimizeRepeatedSections } };
  } catch (err) {
    // TODO: diagnostic temporaire — à retirer une fois le flux stabilisé
    console.error('[export/set page] Error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Erreur lors de la préparation de l'export : ${msg}` };
  }
}

export default async function ExportSetPage({ params, searchParams }: ExportSetPageProps) {
  const { id: setId } = await params;
  const { token } = await searchParams;

  const tokenData = token ? await verifyAndConsumeExportToken(token, setId) : null;

  if (!tokenData) {
    return <div data-export-error="true">Lien d&apos;export invalide ou expiré.</div>;
  }

  const result = await prepareExport(setId, tokenData.userId);

  if (!result.ok) {
    return <div data-export-error="true">{result.error}</div>;
  }

  const { sheets, overrides, additions, printChordDiagrams, printMinimizeRepeatedSections } = result.data;

  return (
    <ExportProviders overrides={overrides} additions={additions}>
      <div data-export-ready="true">
        {sheets.map((sheet, i) => (
          <div key={sheet.id} style={i < sheets.length - 1 ? { pageBreakAfter: 'always' } : undefined}>
            <SheetViewer
              sheet={sheet}
              printChordDiagramsOverride={printChordDiagrams}
              printMinimizeRepeatedSectionsOverride={printMinimizeRepeatedSections}
            />
          </div>
        ))}
      </div>
    </ExportProviders>
  );
}
