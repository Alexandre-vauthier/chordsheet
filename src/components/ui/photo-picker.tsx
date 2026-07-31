'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadSquareImage, ImageTooLargeError, NotAnImageError, UploadForbiddenError } from '@/lib/upload-image';

/**
 * Pastille photo avec dépôt de fichier : avatar d'un compte, photo d'un groupe.
 *
 * Le composant ne connaît ni Firestore ni le modèle appelant : il reçoit le
 * chemin de stockage et rend l'URL obtenue, à charge de l'appelant de la
 * persister où il faut.
 */
export function PhotoPicker({
  url,
  fallback,
  storagePath,
  editable = true,
  size = 'md',
  onChange,
}: {
  url?: string | null;
  /** Affiché quand il n'y a pas de photo : initiales, icône… */
  fallback: React.ReactNode;
  storagePath: string;
  editable?: boolean;
  size?: 'md' | 'lg';
  /** URL déposée, ou null quand la photo est retirée. */
  onChange: (url: string | null) => Promise<void> | void;
}) {
  const t = useTranslations('PhotoPicker');
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const box = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-16 h-16 text-lg';

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadSquareImage(file, storagePath);
      await onChange(uploaded);
    } catch (e) {
      if (e instanceof ImageTooLargeError) setError(t('tooLarge'));
      else if (e instanceof NotAnImageError) setError(t('notAnImage'));
      else if (e instanceof UploadForbiddenError) setError(t('forbidden'));
      else setError(t('uploadFailed'));
      // Le détail technique reste en console : le message affiché doit rester lisible.
      console.error('[PhotoPicker] dépôt impossible', e);
    } finally {
      setBusy(false);
      // Réinitialise l'input : redéposer le même fichier doit redéclencher l'événement.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className={`relative ${box} shrink-0`}>
        <div className={`${box} rounded-full overflow-hidden bg-[var(--accent)] flex items-center justify-center text-white font-bold`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            fallback
          )}
        </div>
        {busy && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          </div>
        )}
      </div>

      {editable && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            >
              {url ? t('replace') : t('add')}
            </button>
            {url && (
              <button
                type="button"
                onClick={async () => { setBusy(true); try { await onChange(null); } finally { setBusy(false); } }}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded-lg text-[var(--ink-faint)] hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {t('remove')}
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--ink-faint)]">{t('hint')}</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
