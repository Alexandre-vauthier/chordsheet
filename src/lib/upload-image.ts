import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getStorage } from '@/lib/firebase';

/**
 * Dépôt d'une photo (avatar utilisateur, photo de groupe).
 *
 * L'image est systématiquement recadrée en carré et rééchantillonnée avant
 * l'envoi : une photo de téléphone pèse plusieurs mégaoctets, alors qu'elle est
 * affichée dans une pastille de 32 px. On envoie donc ~50 Ko au lieu de 5 Mo.
 *
 * Le nom de fichier est stable (pas d'horodatage) : un nouveau dépôt écrase le
 * précédent, ce qui évite d'accumuler des orphelins dans le bucket. Firebase
 * régénère le jeton de téléchargement à l'écrasement, l'URL change donc et aucun
 * cache ne reste bloqué sur l'ancienne image.
 */

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // 10 Mo en entrée
const OUTPUT_SIZE = 512;                          // côté de l'image produite, en px
const OUTPUT_QUALITY = 0.85;

export class ImageTooLargeError extends Error {}
export class NotAnImageError extends Error {}
/** Le dépôt a été refusé par les règles Storage (règles non déployées, ou chemin interdit). */
export class UploadForbiddenError extends Error {}

/**
 * Recadre au centre en carré, rééchantillonne, et renvoie un JPEG.
 * Le recadrage central est volontaire : c'est ce qui correspond à un affichage
 * en pastille ronde, où les bords sont de toute façon rognés.
 */
export async function prepareSquareImage(file: File, size = OUTPUT_SIZE): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new NotAnImageError(file.type);
  if (file.size > MAX_SOURCE_BYTES) throw new ImageTooLargeError(String(file.size));

  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d indisponible');
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', OUTPUT_QUALITY),
    );
    if (!blob) throw new Error('encodage JPEG impossible');
    return blob;
  } finally {
    bitmap.close();
  }
}

/** Chemin de l'avatar d'un utilisateur. Le segment uid est vérifié par les règles Storage. */
export function avatarPath(userId: string): string {
  return `avatars/${userId}/avatar.jpg`;
}

/**
 * Chemin d'une photo de groupe. Le uid du déposant est dans le chemin : les
 * règles Storage peuvent ainsi le contrôler, alors qu'elles ne savent pas lire
 * Firestore pour vérifier qui est leader du groupe. C'est le document du groupe,
 * protégé lui par les règles Firestore, qui désigne la photo retenue.
 */
export function groupPhotoPath(groupId: string, userId: string): string {
  return `group-photos/${groupId}/${userId}/photo.jpg`;
}

/** Prépare puis dépose l'image, et renvoie son URL de téléchargement. */
export async function uploadSquareImage(file: File, path: string): Promise<string> {
  const blob = await prepareSquareImage(file);
  try {
    const snap = await uploadBytes(storageRef(getStorage(), path), blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=86400',
    });
    return getDownloadURL(snap.ref);
  } catch (e) {
    // `storage/unauthorized` signifie que les règles refusent le chemin. La cause
    // de loin la plus fréquente : storage.rules n'a pas été déployé, et seul
    // analyze-uploads/ est autorisé. Le distinguer évite de chercher un bug
    // applicatif là où il n'y en a pas.
    const code = (e as { code?: string })?.code;
    if (code === 'storage/unauthorized') throw new UploadForbiddenError(path);
    throw e;
  }
}
