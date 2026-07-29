// Décode un segment de route (titre, artiste…). decodeURIComponent seul plante sur
// un '%' isolé ou une séquence invalide (ex. un titre « 50% ») ; on retombe alors
// sur la valeur brute. Idempotent sur une valeur déjà décodée (pas de double-décodage
// destructeur pour les cas courants : espaces, accents…).
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
