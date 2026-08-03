import { getAdminDb } from '@/lib/firebase-admin';
import { libraryKey } from '@/lib/library-key';
import type { AjoutsAdmin } from '@/lib/unknown-chords';

/**
 * Les accords que la bibliothèque doit à un administrateur, lus côté serveur.
 *
 * Le navigateur les charge par `LibraryChordsProvider` ; une route n'a pas de
 * contexte React, d'où cette lecture directe. On rend des clés `libraryKey` plutôt
 * que les doigtés : le contrôle veut savoir si un accord existe, pas comment il se
 * dessine.
 *
 * Les remplacements (`isOverride`) comptent comme les ajouts : ils portent le nom
 * d'un accord déjà connu, les inclure ne change rien, et les distinguer ferait un
 * cas particulier pour rien.
 */
export async function loadAdminChordKeys(): Promise<AjoutsAdmin> {
  try {
    const snap = await getAdminDb().collection('library_chords').get();
    const docs = snap.docs as { data: () => Record<string, unknown> }[];

    const cles = new Set<string>();
    for (const d of docs) {
      const raw = d.data();
      const chord = raw.chord as { name?: unknown } | undefined;
      const name = typeof chord?.name === 'string' ? chord.name : '';
      const instrument = typeof raw.instrumentId === 'string' ? raw.instrumentId : '';
      if (name && instrument) cles.add(libraryKey(name, instrument as never));
    }
    return cles;
  } catch {
    // Lecture indisponible : on préfère un contrôle trop sévère (quelques accords
    // signalés à tort) à un contrôle muet qui laisserait croire que tout va bien.
    return new Set<string>();
  }
}
