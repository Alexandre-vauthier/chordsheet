'use client';

import { getAuth } from 'firebase/auth';

/**
 * Signale au serveur qu'une grille vient d'être enregistrée.
 *
 * Le serveur relit lui-même le document et décide s'il y a quelque chose à annoncer :
 * on ne lui envoie que l'identifiant, jamais la liste des accords. Un client peut
 * mentir sur ce qu'il a écrit, pas sur ce que Firestore contient.
 *
 * Silencieux par construction : personne ne doit voir un enregistrement échouer
 * parce qu'une alerte interne n'est pas partie.
 */
export async function reportUnknownChords(sheetId: string): Promise<void> {
  try {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;
    await fetch('/api/sheets/report-unknown-chords', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId }),
    });
  } catch {
    /* sans effet sur l'enregistrement */
  }
}
