'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLyrics } from '@/lib/use-lyrics';
import { playPreviewAudio, stopPreviewAudio } from '@/lib/preview-audio';
import type { Sheet, CellSpan, InstrumentId } from '@/types';
import { INSTRUMENTS } from '@/types';
import { ChordSummary, InstrumentSelector, ChordDiagram, PianoKeyboard } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';
import type { StringChord, PianoChord, CustomChord } from '@/types';
import { isPianoChord } from '@/types';
import { useChordNotation } from '@/lib/use-chord-notation';
import { useChordColor } from '@/lib/use-chord-color';
import { transposeChord } from '@/lib/transpose';
import { usePlayback, parseTempo, buildChordSequence, ACCOMPANIMENT_INSTRUMENTS } from '@/lib/use-playback';
import { useGrooveBox, PATTERN_DEFS } from '@/lib/use-groove-box';
import type { PlayStep, PlayStyle, PlaybackVoice } from '@/lib/use-playback';
import { useArtwork } from '@/lib/use-artwork';
import { useAuth } from '@/lib/auth-context';
import { swapSelectorVoice } from '@/lib/accompaniment';
import { INSTRUMENT_CONFIG, findChordVariants, parseChordInput } from '@/lib/chord-data';
import { useChordVariants } from '@/lib/use-chord-variants';
import { playChord, playMetronomeTick, preloadInstrument } from '@/lib/chord-audio';
import { transposeSections, transposeKey } from '@/lib/transpose';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useGenreLabel } from '@/lib/use-genre-labels';
import { LiveChordFollow, type ActiveRow } from './live-chord-follow';

const LS_KEY = 'chordsheet_instrument';

function getSavedInstrument(fallback: InstrumentId): InstrumentId {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(LS_KEY) as InstrumentId;
  return v && (INSTRUMENTS as readonly string[]).includes(v) ? v : fallback;
}

function hasLocalInstrument(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(LS_KEY) as InstrumentId;
  return !!(v && (INSTRUMENTS as readonly string[]).includes(v));
}

/**
 * Amplitude de transposition, en demi-tons. La valeur reprend celle annoncée dans la
 * FAQ ; le code ne bornait rien jusqu'ici, si bien que le compteur affiché pouvait
 * dériver au-delà de l'octave alors que le calcul est modulo 12 — +13 sonnait comme
 * +1 mais s'affichait « +13 ».
 */
const TRANSPOSE_LIMIT = 6;

// Map instrument -> style de jeu (plaqué / arpège). Une entrée = instrument activé.
type AccompMap = Record<string, PlayStyle>;

/**
 * Point de départ de l'accompagnement à chaque chargement de grille : l'instrument
 * du sélecteur, en plaqué. Rien n'est relu depuis la grille (l'auteur ne fixe plus
 * de config de lecture) ni depuis le stockage local (le choix de session n'est pas
 * mémorisé d'une grille à l'autre).
 */
function initialAccompaniment(instrument: InstrumentId, chordsAudioDisabled: boolean): AccompMap {
  return chordsAudioDisabled ? {} : { [instrument]: 'block' };
}

// Icône SVG (au lieu des glyphes Unicode ♩/♪, absents des polices de l'environnement
// headless utilisé pour l'export PDF serveur)
function NoteIcon({ unit, className }: { unit: 'quarter' | 'eighth'; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <ellipse cx="4.5" cy="12" rx="3.2" ry="2.3" transform="rotate(-18 4.5 12)" />
      <rect x="7.1" y="1.5" width="1.3" height="10.5" />
      {unit === 'eighth' && (
        <path d="M8.4 1.5c2.6 0.9 3.7 2.8 3.3 5.5-0.3-1.7-1.5-2.8-3.3-3.3z" />
      )}
    </svg>
  );
}

interface SheetViewerProps {
  sheet: Sheet;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  isTogglingBookmark?: boolean;
  concertCellPath?: { sectionIdx: number; rowIdx: number; cellIdx: number; durationMs?: number; rowRepeatIndex?: number };
  /** Surcharge des préférences d'impression de l'utilisateur (ex: rendu serveur pour export PDF, sans session Firebase) */
  printChordDiagramsOverride?: boolean;
  printMinimizeRepeatedSectionsOverride?: boolean;
  /** Mode concert (page de lecture d'un set) : masque les options de lecture du
   *  viewer (métronome, boîte à rythmes, instruments, tempo, décompte, Play), qui
   *  sont pilotées par la page concert et inutiles par participant. */
  concertMode?: boolean;
}

function getRefLabel(url: string, referenceFallback: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return '▶ YouTube';
  if (url.includes('spotify.com')) return '♫ Spotify';
  if (url.includes('deezer.com')) return '♫ Deezer';
  if (url.includes('soundcloud.com')) return '♫ SoundCloud';
  if (url.includes('apple.com/music') || url.includes('music.apple')) return '♫ Apple Music';
  return referenceFallback;
}

const spanToGridCols = (span: CellSpan) => Math.round(span / 0.25);

// Signature d'une section = empreinte de ses accords (indépendante du label, repeat, rowRepeats)
function sectionSignature(section: { rows: { chord: string; span: number }[][] }): string {
  return section.rows
    .map(row => row.map(c => `${c.chord}:${c.span}`).join(','))
    .join('|');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SheetViewer({ sheet, isBookmarked, onToggleBookmark, isTogglingBookmark, concertCellPath, printChordDiagramsOverride, printMinimizeRepeatedSectionsOverride, concertMode }: SheetViewerProps) {
  const t = useTranslations('SheetViewer');
  const tGroove = useTranslations('GroovePatterns');
  const genreLabel = useGenreLabel();
  const translate = useChordNotation();
  const getColor = useChordColor();
  const { user, updateUser } = useAuth();
  const [showInlineDiagram, setShowInlineDiagram] = useState(() => user?.showInlineDiagram ?? false);
  const [showChordSummary, setShowChordSummary] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 640) {
      setShowChordSummary(user?.showChordSummaryByDefault ?? true);
    }
    // Mobile : reste false (replié par défaut)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.showChordSummaryByDefault]);
  // L'état initial ne dépend QUE de la grille : c'est la seule valeur que le serveur
  // et le client calculent à l'identique. Lire localStorage ici produirait un rendu
  // serveur différent du premier rendu client, donc une erreur d'hydratation.
  const [instrumentId, setInstrumentId] = useState<InstrumentId>(
    () => sheet.instrumentId ?? 'guitar',
  );

  // Après hydratation seulement : priorité 1 au dernier choix explicite (localStorage),
  // priorité 2 à la préférence du profil une fois l'utilisateur chargé.
  useEffect(() => {
    if (hasLocalInstrument()) setInstrumentId(getSavedInstrument('guitar'));
    else if (user?.preferredInstrument) setInstrumentId(user.preferredInstrument);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.preferredInstrument]);

  // Précharger le son échantillonné de l'instrument courant, pour qu'il soit prêt au premier clic
  useEffect(() => {
    preloadInstrument(instrumentId);
  }, [instrumentId]);

  const handleInstrumentChange = (id: InstrumentId) => {
    setInstrumentId(id);
    localStorage.setItem(LS_KEY, id);
    // Sauvegarder comme instrument de prédilection dans le profil
    updateUser({ preferredInstrument: id }).catch(() => {/* silent */});
  };

  const [metronomeEnabled, setMetronomeEnabled] = useState(() => user?.defaultMetronome ?? false);
  const [grooveEnabled, setGrooveEnabled] = useState(() => user?.defaultGrooveBox ?? false);
  // Pattern de boîte à rythme choisi pour la session (override live du pattern
  // de la grille). undefined = automatique selon les genres.
  const [livePattern, setLivePattern] = useState<string | undefined>(sheet.groovePattern);
  const [grooveMenuOpen, setGrooveMenuOpen] = useState(false);
  const grooveMenuRef = useRef<HTMLDivElement>(null);
  // Métronome et décompte de départ sont regroupés sous un seul bouton-menu :
  // deux réglages liés, qui n'agissent qu'au démarrage de la lecture.
  const [metroMenuOpen, setMetroMenuOpen] = useState(false);
  const metroMenuRef = useRef<HTMLDivElement>(null);
  // Prévisualisation d'un pattern : réutilise le même useGrooveBox (2 mesures puis stop).
  const [previewPattern, setPreviewPattern] = useState<string | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Écoute micro en cours (remontée par LiveChordFollow) : sert à démarrer la
  // boîte à rythme pendant le suivi si elle est activée.
  const [recListening, setRecListening] = useState(false);
  // Lignes actives pendant le suivi micro (pour faire clignoter et décrémenter
  // leurs badges de répétition).
  const [recActiveRows, setRecActiveRows] = useState<ActiveRow[]>([]);
  // Accompagnement joué (Play + suivi REC) : instrument -> style (plaqué / arpège).
  // Chaque chargement de grille repart de l'instrument du sélecteur, en plaqué. Les
  // ajouts faits en session sont volontairement éphémères : ni mémorisés d'une grille
  // à l'autre, ni imposés par l'auteur de la grille.
  const [accompaniment, setAccompaniment] = useState<AccompMap>(
    () => initialAccompaniment(instrumentId, user?.defaultChordsAudio === false),
  );

  // Changement de grille (navigation, et setlist en mode concert où le viewer n'est
  // pas remonté) : on repart du sélecteur. Ajustement d'état pendant le rendu — le
  // motif React prévu pour ça — plutôt qu'un effet, qui laisserait passer un rendu
  // intermédiaire avec l'accompagnement de la grille précédente.
  const [accompSheetId, setAccompSheetId] = useState(sheet.id);
  // L'instrument que le sélecteur a posé dans l'accompagnement, pour savoir quelle
  // entrée remplacer quand il change.
  const [selectorVoice, setSelectorVoice] = useState<InstrumentId>(instrumentId);

  if (accompSheetId !== sheet.id) {
    setAccompSheetId(sheet.id);
    setSelectorVoice(instrumentId);
    setAccompaniment(initialAccompaniment(instrumentId, user?.defaultChordsAudio === false));
  } else if (selectorVoice !== instrumentId) {
    // Changement d'instrument au sélecteur : le Play doit suivre (voir swapSelectorVoice).
    const previous = selectorVoice;
    setSelectorVoice(instrumentId);
    setAccompaniment((prev) => swapSelectorVoice(prev, previous, instrumentId));
  }

  const [accompMenuOpen, setAccompMenuOpen] = useState(false);
  const accompMenuRef = useRef<HTMLDivElement>(null);

  const toggleAccompaniment = (inst: InstrumentId) => {
    setAccompaniment((prev) => {
      const next = { ...prev };
      if (inst in next) delete next[inst]; else next[inst] = 'block';
      return next;
    });
  };
  const setAccompStyle = (inst: InstrumentId, style: PlayStyle) => {
    setAccompaniment((prev) => ({ ...prev, [inst]: style }));
  };

  const accompVoices: PlaybackVoice[] = useMemo(
    () => Object.entries(accompaniment).map(([id, style]) => ({ id: id as InstrumentId, style })),
    [accompaniment],
  );
  const accompCount = accompVoices.length;

  // Précharger le son de chaque instrument d'accompagnement
  useEffect(() => { accompVoices.forEach((v) => preloadInstrument(v.id)); }, [accompVoices]);

  // Fermer le menu au clic extérieur
  useEffect(() => {
    if (!accompMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (accompMenuRef.current && !accompMenuRef.current.contains(e.target as Node)) setAccompMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accompMenuOpen]);

  const [countInEnabled, setCountInEnabled] = useState(() => user?.defaultCountIn ?? false);
  const [countBeat, setCountBeat] = useState(0); // 0 = inactif, 1-4 = décompte
  const countTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [transpose, setTranspose] = useState(0);
  // Le joueur a-t-il physiquement posé le capo indiqué ? Si non, tout ce qui
  // dépend du capo revient à la hauteur réelle des formes : accords piano (qui
  // étaient transposés par le capo), audio de prévisualisation et suivi micro.
  // N'affecte pas les diagrammes/formes de guitare (une forme reste une forme).
  const [capoActive, setCapoActive] = useState(true);
  const effectiveCapo = capoActive ? (sheet.capo ?? 0) : 0;
  const [selectedChords, setSelectedChords] = useState<Record<string, StringChord | PianoChord>>({});
  // On stocke le BPM numérique pur : l'input type="number" affiche vide si la valeur
  // contient du texte (ex. « 120 BPM »), d'où l'usage de parseTempo dès l'init.
  const [localTempo, setLocalTempo] = useState<string>(String(parseTempo(sheet.tempo) || 90));
  const [localTempoUnit, setLocalTempoUnit] = useState<'quarter' | 'eighth'>(sheet.tempoUnit ?? 'quarter');
  const [minimizeRepeated, setMinimizeRepeated] = useState(() => user?.minimizeRepeatedSections ?? false);

  const displaySections = transposeSections(sheet.sections, transpose);
  const displayKey = transposeKey(sheet.key, transpose);

  // Séquence ordonnée pour le suivi micro : chaque cellule dans l'ordre de
  // lecture, avec le son réellement entendu (forme transposée + capo effectif).
  const followSequence = useMemo(
    () =>
      buildChordSequence(displaySections).map((it) => ({
        pos: it.pos,
        rowId: it.rowId,
        sound: effectiveCapo > 0 ? transposeChord(it.chord, effectiveCapo) : it.chord,
        beats: it.span,
        repeatIndex: it.repeatIndex,
        rowRepeat: it.rowRepeat,
      })),
    [displaySections, effectiveCapo],
  );

  // Y a-t-il au moins une section en doublon ?
  const hasRepeatedSections = (() => {
    const seen = new Set<string>();
    for (const s of displaySections) {
      const sig = sectionSignature(s);
      if (seen.has(sig)) return true;
      seen.add(sig);
    }
    return false;
  })();

  // Playback
  const { isPlaying, activeStep, playSection, play, togglePlay, stop } = usePlayback({
    sections: displaySections,
    tempo: localTempo,
    tempoUnit: localTempoUnit,
    instrumentId,
    playbackInstruments: accompVoices,
    customChords: sheet.customChords as Record<string, unknown>,
    selectedChords,
    metronomeEnabled,
    chordsEnabled: accompCount > 0,
    capo: sheet.capo ?? 0,
  });

  // Jouer un accord (par son nom déjà transposé + capo) sur les instruments
  // d'accompagnement — utilisé par le suivi micro à chaque changement d'accord.
  // Pendant le REC, on ne joue l'accompagnement QUE si la boîte à rythme est
  // cochée (sinon le suivi reste silencieux, purement visuel).
  // En REC l'accompagnement reste en plaqué (l'arpège au tempo est réservé au Play).
  const playAccompanimentChord = useCallback((chordName: string) => {
    if (!grooveEnabled || !accompVoices.length) return;
    const parsed = parseChordInput(chordName).chord;
    for (const voice of accompVoices) {
      const custom = (sheet.customChords as Record<string, CustomChord> | undefined)?.[`${parsed.toLowerCase()}-${voice.id}`];
      const chordData = (custom as StringChord | PianoChord | undefined) ?? findChordVariants(parsed, voice.id)[0];
      if (chordData) playChord(chordData, voice.id, 0); // le nom inclut déjà transposition + capo
    }
  }, [grooveEnabled, accompVoices, sheet.customChords]);

  const bpm = parseTempo(sheet.tempo);

  const cancelCountIn = useCallback(() => {
    countTimersRef.current.forEach(clearTimeout);
    countTimersRef.current = [];
    setCountBeat(0);
  }, []);

  // Cleanup au démontage
  useEffect(() => () => cancelCountIn(), [cancelCountIn]);

  // Auto-scroll : ligne active sous le bandeau fixe, avec marge de confort
  // (même offset que le suivi micro, cf. NAVBAR_OFFSET dans live-chord-follow).
  const scrollToRow = useCallback((rowId: string) => {
    const el = document.querySelector(`[data-row-id="${rowId}"]`) as HTMLElement | null;
    if (!el) return;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 104, behavior: 'smooth' });
  }, []);

  const handlePlay = useCallback(() => {
    if (isPlaying) { stop(); return; }
    if (countBeat > 0) { cancelCountIn(); return; }
    if (!countInEnabled) { play(); return; }

    // Scroll vers la première ligne dès le démarrage du décompte
    const firstSection = displaySections[0];
    if (firstSection) {
      const firstRowIndex = firstSection.rows.findIndex(r => r.some(c => c.chord));
      if (firstRowIndex !== -1) scrollToRow(`${firstSection.id}-${firstRowIndex}`);
    }

    const factor = localTempoUnit === 'eighth' ? 0.5 : 1;
    const msPerBeat = (60000 / parseTempo(localTempo)) * factor;

    for (let b = 1; b <= 4; b++) {
      const t = setTimeout(() => {
        setCountBeat(b);
        playMetronomeTick(b === 1);
      }, (b - 1) * msPerBeat);
      countTimersRef.current.push(t);
    }
    const startT = setTimeout(() => {
      setCountBeat(0);
      countTimersRef.current = [];
      play();
    }, 4 * msPerBeat);
    countTimersRef.current.push(startT);
  }, [isPlaying, countBeat, countInEnabled, stop, cancelCountIn, play, localTempo, localTempoUnit, displaySections, scrollToRow]);

  useEffect(() => {
    if (!isPlaying || !activeStep) return;
    scrollToRow(`${activeStep.sectionId}-${activeStep.rowIndex}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep?.sectionId, activeStep?.rowIndex]);

  useEffect(() => {
    if (!concertCellPath) return;
    const section = displaySections[concertCellPath.sectionIdx];
    if (section) scrollToRow(`${section.id}-${concertCellPath.rowIdx}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concertCellPath?.sectionIdx, concertCellPath?.rowIdx]);

  const grooveBpm = (() => { const b = parseTempo(localTempo); return b > 100 ? Math.round(b / 2) : b; })();

  // Prévisualiser un pattern : l'entend 2 mesures puis s'arrête (dé-mute le temps
  // de l'aperçu). Recliquer le même pattern coupe l'aperçu.
  const togglePreviewPattern = useCallback((patternId: string) => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    setPreviewPattern((current) => {
      if (current === patternId) return null;
      const measureSeconds = (60 / grooveBpm) * (sheet.beatsPerMeasure ?? 4);
      previewTimeoutRef.current = setTimeout(() => setPreviewPattern(null), measureSeconds * 2 * 1000);
      return patternId;
    });
  }, [grooveBpm, sheet.beatsPerMeasure]);

  useEffect(() => () => { if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current); }, []);
  useEffect(() => { if (isPlaying) setPreviewPattern(null); }, [isPlaying]);
  // Fermer le menu de pattern au clic extérieur
  useEffect(() => {
    if (!grooveMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (grooveMenuRef.current && !grooveMenuRef.current.contains(e.target as Node)) setGrooveMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [grooveMenuOpen]);

  useEffect(() => {
    if (!metroMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (metroMenuRef.current && !metroMenuRef.current.contains(e.target as Node)) setMetroMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [metroMenuOpen]);

  useGrooveBox({
    // Tourne pendant la lecture, pendant le suivi micro si la boîte à rythme est
    // activée, ou pendant un aperçu de pattern.
    enabled: isPlaying || (recListening && grooveEnabled) || previewPattern !== null,
    muted: previewPattern !== null ? false : !grooveEnabled,
    bpm: grooveBpm,
    beatsPerMeasure: sheet.beatsPerMeasure ?? 4,
    genres: sheet.genres ?? [],
    // L'aperçu prime, sinon le choix de session (livePattern).
    groovePattern: previewPattern ?? livePattern,
  });

  const { artworkUrl, previewUrl, trackUrl } = useArtwork(sheet.artist, sheet.title);

  // Paroles : celles que l'auteur a saisies font foi ; à défaut on interroge le
  // service externe **à l'affichage**, sans jamais conserver le résultat. Le hook
  // travaille côté client, donc rien ne part dans le HTML servi et rien ne
  // s'indexe — c'était déjà la règle, elle ne bouge pas.
  const { lyrics } = useLyrics(sheet.artist, sheet.title, sheet.lyrics);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Changer d'onglet coupe l'extrait : personne ne cherche à écouter une page qu'il
  // ne regarde plus, et le son venu d'un onglet caché est déroutant.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopPreviewAudio();
        setPreviewPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const togglePreview = () => {
    if (!previewUrl) return;
    if (previewPlaying) {
      stopPreviewAudio();
      setPreviewPlaying(false);
    } else {
      setPreviewPlaying(true);
      playPreviewAudio(previewUrl, () => setPreviewPlaying(false));
    }
  };

  // Quitter la grille coupe l'extrait. Sans ça il poursuivait sa lecture sur la page
  // suivante, sans plus aucun bouton pour l'arrêter.
  useEffect(() => stopPreviewAudio, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="mb-8 border-b-2 border-[var(--ink)] pb-4 print:mb-6 print:pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {/* Artwork + Titre : toujours sur la même ligne */}
          <div className="relative flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Artwork */}
          {artworkUrl && (
            <div className="flex-shrink-0 print:hidden">
              <div
                className="relative w-20 h-20 group/art cursor-pointer"
                onClick={previewUrl ? togglePreview : undefined}
                title={previewUrl ? (previewPlaying ? t('pauseSample') : t('playSample')) : undefined}
              >
                <img
                  src={artworkUrl}
                  alt={`${sheet.artist} — ${sheet.title}`}
                  className="w-20 h-20 rounded-lg shadow-md object-cover"
                />
                {previewUrl && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover/art:bg-black/30 transition-all duration-200">
                    <span className={`text-white text-xl transition-opacity duration-200 ${previewPlaying ? 'opacity-100' : 'opacity-0 group-hover/art:opacity-100'}`}>
                      {previewPlaying ? '⏸' : '▶'}
                    </span>
                  </div>
                )}
              </div>
              {/* La mention devient un lien vers la fiche Apple Music : les conditions
                  de l'API autorisent pochette et extrait pour **promouvoir** le
                  catalogue, ce qui suppose d'y renvoyer. Le clic sur la vignette reste
                  réservé à l'extrait. */}
              {trackUrl ? (
                <a
                  href={trackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[8px] text-[var(--ink-faint)] hover:text-[var(--accent)] mt-0.5 text-center transition-colors"
                >
                  {t('viaItunes')}
                </a>
              ) : (
                <p className="text-[8px] text-[var(--ink-faint)] mt-0.5 text-center">{t('viaItunes')}</p>
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] print:text-2xl">
                {sheet.title || t('untitled')}
              </h1>
              {onToggleBookmark && (
                <button
                  onClick={onToggleBookmark}
                  disabled={isTogglingBookmark}
                  title={isBookmarked ? t('removeFromBook') : t('addToBook')}
                  className={`print:hidden shrink-0 text-2xl leading-none transition-colors ${
                    isBookmarked ? 'text-amber-400' : 'text-[var(--ink-faint)] hover:text-amber-400'
                  }`}
                >
                  {isBookmarked ? '★' : '☆'}
                </button>
              )}
            </div>
            {sheet.artist && (
              <Link
                href={`/artist/${encodeURIComponent(sheet.artist)}`}
                className="text-lg text-[var(--ink-light)] mt-1 block hover:text-[var(--accent)] transition-colors print:text-[var(--ink-light)]"
              >
                {sheet.artist}
              </Link>
            )}
            {sheet.ownerName && (
              <p className="text-xs text-[var(--ink-faint)] mt-1 print:hidden">
                {t('by')}{' '}
                {sheet.ownerId && sheet.ownerId !== 'deleted' ? (
                  <Link
                    href={`/user/${sheet.ownerId}`}
                    className="hover:text-[var(--accent)] transition-colors"
                  >
                    {sheet.ownerName}
                  </Link>
                ) : (
                  sheet.ownerName
                )}
              </p>
            )}
          </div>
          {sheet.capo ? (
            <button
              onClick={() => setCapoActive(v => !v)}
              title={capoActive ? t('capoOn') : t('capoOff')}
              className={`sm:hidden print:hidden absolute bottom-0 right-0 px-2 py-0.5 rounded-md text-xs font-bold border border-black/10 shadow-sm bg-[linear-gradient(90deg,#e74c3c,#f1c40f,#2ecc71,#3498db,#9b59b6)] text-black transition-opacity ${capoActive ? '' : 'line-through opacity-60'}`}
            >
              {t('capo', { n: sheet.capo })}
            </button>
          ) : null}
          </div>{/* fin artwork+titre */}

          {/* Contrôles : ligne pleine largeur sous le titre sur mobile, colonne droite sur desktop */}
          <div className="print:hidden flex flex-col gap-2 sm:flex-shrink-0 sm:items-end w-full sm:w-auto">
            {!concertMode && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tempo éditable */}
              <div className="flex items-center gap-1 px-3 py-2 bg-[var(--cell-bg)] text-[var(--ink)] rounded-lg border-[1.5px] border-[var(--line)] hover:border-[var(--ink-faint)] transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    const units = ['quarter', 'eighth'] as const;
                    setLocalTempoUnit(u => units[(units.indexOf(u) + 1) % units.length]);
                  }}
                  title={t('changeTempoUnit')}
                  className="hover:text-[var(--accent)] transition-colors cursor-pointer"
                >
                  <NoteIcon unit={localTempoUnit} className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={40}
                  max={300}
                  value={localTempo}
                  onChange={(e) => setLocalTempo(e.target.value)}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value);
                    setLocalTempo(String(v >= 40 && v <= 300 ? v : parseTempo(sheet.tempo)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-10 bg-transparent border-none outline-none text-sm font-medium text-center
                    [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  title={t('editTempo')}
                />
                <span className="text-xs text-[var(--ink-light)]">BPM</span>
              </div>

              {/* Métronome : bouton-menu réunissant le clic et le décompte de départ.
                  Deux réglages liés (ils n'agissent qu'au démarrage de la lecture),
                  regroupés pour alléger la barre. */}
              <div className="relative" ref={metroMenuRef}>
                <button
                  onClick={() => setMetroMenuOpen(v => !v)}
                  title={t('metronomeMenu')}
                  className={`
                    relative flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                    ${metronomeEnabled
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                      : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    }
                  `}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                    <path d="M12 3 8 21" strokeLinecap="round"/>
                    <path d="M12 3l4 18" strokeLinecap="round"/>
                    <path d="M8.5 14.5l7-4" strokeLinecap="round"/>
                    <ellipse cx="12" cy="21" rx="3" ry="1.5"/>
                    <line x1="9.5" y1="3" x2="14.5" y2="3" strokeLinecap="round"/>
                  </svg>
                  {/* Pastille : le décompte est armé — visible même quand le clic est coupé,
                      sinon le réglage serait invisible une fois le menu refermé. */}
                  {countInEnabled && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--accent)] border-2 border-[var(--paper)]" />
                  )}
                </button>

                {metroMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--cell-bg)] border border-[var(--line)] rounded-xl shadow-lg py-1 min-w-max whitespace-nowrap">
                    {[
                      { on: metronomeEnabled, toggle: () => setMetronomeEnabled(v => !v), label: t('metronomeClick') },
                      { on: countInEnabled, toggle: () => setCountInEnabled(v => !v), label: t('countIn') },
                    ].map(({ on, toggle, label }) => (
                      <button
                        key={label}
                        onClick={toggle}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                      >
                        <span className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full border ${on ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--line)]'}`}>
                          {on && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Boîte à rythme : bouton unique (activer + choisir le pattern), "Aucun" en tête */}
              <div className="relative" ref={grooveMenuRef}>
                <button
                  onClick={() => setGrooveMenuOpen(v => !v)}
                  title={t('grooveBoxPattern')}
                  className={`
                    flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                    ${grooveEnabled
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                      : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    }
                  `}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                    <ellipse cx="12" cy="9" rx="7" ry="2.5"/>
                    <line x1="5" y1="9" x2="5" y2="16" strokeLinecap="round"/>
                    <line x1="19" y1="9" x2="19" y2="16" strokeLinecap="round"/>
                    <path d="M5 16c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5" strokeLinecap="round"/>
                  </svg>
                </button>
                {grooveMenuOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-50 w-60 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto bg-[var(--cream)] border border-[var(--line)] rounded-xl shadow-xl py-1">
                    <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                      {t('grooveBoxPattern')}
                    </p>
                    {/* Aucun : coupe la boîte à rythme */}
                    <button
                      onClick={() => setGrooveEnabled(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border ${!grooveEnabled ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'} flex items-center justify-center`}>
                        {!grooveEnabled && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      {t('accompNone')}
                    </button>
                    <div className="mx-3 my-1 h-px bg-[var(--line)]" />
                    <button
                      onClick={() => { setGrooveEnabled(true); setLivePattern(undefined); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border ${grooveEnabled && !livePattern ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'} flex items-center justify-center`}>
                        {grooveEnabled && !livePattern && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      {t('automaticByGenre')}
                    </button>
                    {Array.from(new Set(PATTERN_DEFS.map(p => p.category))).map((category) => (
                      <div key={category}>
                        <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">{category}</p>
                        {PATTERN_DEFS.filter(p => p.category === category).map((p) => {
                          const selected = grooveEnabled && livePattern === p.id;
                          const previewing = previewPattern === p.id;
                          return (
                            <div key={p.id} className="flex items-center">
                              <button
                                onClick={() => { setGrooveEnabled(true); setLivePattern(p.id); }}
                                className="flex-1 flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
                              >
                                <span className={`w-3.5 h-3.5 rounded-full border ${selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line)]'} flex items-center justify-center`}>
                                  {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </span>
                                {tGroove(p.id)}
                              </button>
                              <button
                                onClick={() => togglePreviewPattern(p.id)}
                                title={previewing ? t('stopPreviewPattern') : t('listenToPattern')}
                                className={`shrink-0 w-8 h-8 mr-1 flex items-center justify-center rounded-lg transition-colors ${previewing ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)] hover:text-[var(--accent)]'}`}
                              >
                                {previewing ? (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sélecteur d'instrument : remonté ici, il pilote aussi la voix jouée. */}
              <InstrumentSelector
                value={instrumentId}
                onChange={handleInstrumentChange}
                exclude={lyrics ? [] : ['voice']}
              />

              {/* Lecture des accords — menu des instruments d'accompagnement */}
              <div className="relative" ref={accompMenuRef}>
                <button
                  onClick={() => setAccompMenuOpen(v => !v)}
                  title={t('chordAudioInstruments')}
                  className={`
                    relative flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                    ${accompCount > 0
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                      : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    }
                  `}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                    <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                  {accompCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--ink)] text-white text-[10px] font-bold">
                      {accompCount}
                    </span>
                  )}
                </button>
                {accompMenuOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-50 w-60 max-w-[calc(100vw-2rem)] bg-[var(--cream)] border border-[var(--line)] rounded-xl shadow-xl overflow-hidden py-1">
                    <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                      {t('chordAudioInstruments')}
                    </p>
                    {/* Aucun : coupe tous les instruments (seule la boîte à rythmes joue) */}
                    <button
                      onClick={() => setAccompaniment({})}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      <span className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full border ${accompCount === 0 ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--line)]'}`}>
                        {accompCount === 0 && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{t('accompNone')}</span>
                    </button>
                    <div className="mx-3 my-1 h-px bg-[var(--line)]" />
                    {ACCOMPANIMENT_INSTRUMENTS.map((inst) => {
                      const style = accompaniment[inst];
                      const checked = style !== undefined;
                      return (
                        <div key={inst} className="flex items-center gap-1 pr-2">
                          <button
                            onClick={() => toggleAccompaniment(inst)}
                            className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
                          >
                            <span className={`shrink-0 flex items-center justify-center w-4 h-4 rounded border ${checked ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--line)]'}`}>
                              {checked && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{INSTRUMENT_CONFIG[inst]?.label ?? inst}</span>
                          </button>
                          {checked && (
                            <div className="shrink-0 flex rounded-md border border-[var(--line)] overflow-hidden text-[10px]">
                              {(['block', 'arpeggio'] as PlayStyle[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setAccompStyle(inst, s)}
                                  title={s === 'block' ? t('styleBlock') : t('styleArpeggio')}
                                  className={`px-1.5 py-1 transition-colors ${style === s ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-light)] hover:bg-[var(--accent-soft)]'}`}
                                >
                                  {s === 'block' ? t('styleBlock') : t('styleArpeggio')}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>


              {/* Play / Stop */}
              <button
                onClick={handlePlay}
                title={isPlaying ? 'Stop' : countBeat > 0 ? t('cancelCountIn') : t('playWithBpm', { bpm })}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-all duration-150 border-[1.5px]
                  ${isPlaying || countBeat > 0
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[#a83d25]'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }
                `}
              >
                {countBeat > 0 ? (
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map(b => (
                      <span
                        key={b}
                        className={`w-2 h-2 rounded-full transition-all duration-75 ${
                          b === countBeat ? 'bg-white scale-150' : b < countBeat ? 'bg-white/50' : 'bg-white/25'
                        }`}
                      />
                    ))}
                  </div>
                ) : isPlaying ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <rect x="4" y="3" width="4" height="14" rx="1" />
                      <rect x="12" y="3" width="4" height="14" rx="1" />
                    </svg>
                    Stop
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    Play
                  </>
                )}
              </button>
            </div>
            )}

            {/* Métadonnées compactes sous les boutons */}
            <div className="hidden sm:flex flex-wrap items-center gap-1.5 sm:justify-end">
              {/* Genres — cliquables vers Explorer filtré */}
              {sheet.genres?.map((genre) => (
                <Link
                  key={genre}
                  href={`/explore?genre=${encodeURIComponent(genre)}`}
                  className="px-2 py-0.5 bg-[var(--line)] text-[var(--ink-light)] rounded-full text-xs font-medium hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
                >
                  {genreLabel(genre)}
                </Link>
              ))}

              {/* Tonalité + transpose */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTranspose(t => Math.max(-TRANSPOSE_LIMIT, t - 1))}
                  disabled={transpose <= -TRANSPOSE_LIMIT}
                  className="w-5 h-5 flex items-center justify-center rounded border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xs font-medium disabled:opacity-30 disabled:hover:border-[var(--line)] disabled:hover:text-[var(--ink-light)]"
                >−</button>
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--cell-bg)] text-[var(--ink)] rounded text-xs min-w-[3rem] justify-center border border-[var(--line)]">
                  {displayKey || '—'}
                  {transpose !== 0 && (
                    <span className="text-[9px] opacity-70">{transpose > 0 ? `+${transpose}` : transpose}</span>
                  )}
                </span>
                <button
                  onClick={() => setTranspose(t => Math.min(TRANSPOSE_LIMIT, t + 1))}
                  disabled={transpose >= TRANSPOSE_LIMIT}
                  className="w-5 h-5 flex items-center justify-center rounded border border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xs font-medium disabled:opacity-30 disabled:hover:border-[var(--line)] disabled:hover:text-[var(--ink-light)]"
                >+</button>
                {transpose !== 0 && (
                  <button
                    onClick={() => setTranspose(0)}
                    className="text-[9px] text-[var(--ink-faint)] hover:text-[var(--accent)] transition-colors"
                    title={t('reset')}
                  >↺</button>
                )}
              </div>

              {sheet.capo ? (
                <button
                  onClick={() => setCapoActive(v => !v)}
                  title={capoActive ? t('capoOn') : t('capoOff')}
                  className={`px-2 py-0.5 rounded-md text-xs font-bold border border-black/10 shadow-sm bg-[linear-gradient(90deg,#e74c3c,#f1c40f,#2ecc71,#3498db,#9b59b6)] text-black transition-opacity ${capoActive ? '' : 'line-through opacity-60'}`}
                >
                  {t('capo', { n: sheet.capo })}
                </button>
              ) : null}
              {sheet.beatsPerMeasure === 3 && (
                <span className="px-1.5 py-0.5 bg-[var(--cell-bg)] text-[var(--ink-light)] rounded text-xs border border-[var(--line)]">
                  {t('ternary')}
                </span>
              )}
              {sheet.referenceUrl && (
                <a
                  href={sheet.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-xs hover:bg-red-100 transition-colors"
                >
                  {getRefLabel(sheet.referenceUrl, t('referenceLabel'))}
                </a>
              )}
            </div>
          </div>

          {/* Métadonnées print uniquement — colonne droite */}
          <div className="hidden print:flex flex-col items-end justify-center gap-1 shrink-0 text-right">
            {sheet.key && (
              <span className="text-sm font-semibold text-[var(--ink)]">
                {displayKey}
              </span>
            )}
            <span className="flex items-center gap-1 text-sm text-[var(--ink)]">
              <NoteIcon unit={localTempoUnit} className="w-3 h-3" />
              {localTempo} BPM
            </span>
            {sheet.capo ? (
              <span className="text-sm text-[var(--ink-light)]">{t('capo', { n: sheet.capo })}</span>
            ) : null}
            {sheet.beatsPerMeasure === 3 && (
              <span className="text-sm text-[var(--ink-light)]">{t('ternary')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Barre instrument + diagrammes */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-between mb-3">
          {instrumentId !== 'voice' && (
            <button
              onClick={() => setShowChordSummary(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors"
            >
              {t('chordsUsed')}
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showChordSummary ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          )}
          <div className={`flex items-center gap-3 ${instrumentId === 'voice' ? 'ml-auto' : ''}`}>
            {showChordSummary && instrumentId !== 'voice' && hasRepeatedSections && (
              <button
                onClick={() => {
                  const next = !minimizeRepeated;
                  setMinimizeRepeated(next);
                  updateUser({ minimizeRepeatedSections: next }).catch(() => {/* silent */});
                }}
                title={t('hideRepeatedSectionsTitle')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  minimizeRepeated
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round"/>
                </svg>
                {t('minimize')}
              </button>
            )}
            {showChordSummary && instrumentId !== 'voice' && (
              <button
                onClick={() => setShowInlineDiagram(v => !v)}
                title={showInlineDiagram ? t('hideInlineDiagrams') : t('showInlineDiagrams')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  showInlineDiagram
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--ink-faint)]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="2" width="18" height="20" rx="2" strokeWidth="1.8"/>
                  <line x1="7" y1="7" x2="17" y2="7" strokeWidth="1.5"/>
                  <line x1="7" y1="11" x2="17" y2="11" strokeWidth="1.5"/>
                  <line x1="7" y1="15" x2="17" y2="15" strokeWidth="1.5"/>
                  <line x1="7" y1="2" x2="7" y2="22" strokeWidth="1.2"/>
                  <line x1="12" y1="2" x2="12" y2="22" strokeWidth="1.2"/>
                  <line x1="17" y1="2" x2="17" y2="22" strokeWidth="1.2"/>
                </svg>
                {t('diagrams')}
              </button>
            )}
          </div>
        </div>
        {showChordSummary && instrumentId !== 'voice' && (
          <ChordSummary
            sections={displaySections}
            instrumentId={instrumentId}
            customChords={sheet.customChords as CustomChordMap}
            capo={effectiveCapo}
            compact
            onVariantChange={(chordName, chord) =>
              setSelectedChords(prev => ({ ...prev, [chordName]: chord }))
            }
          />
        )}
      </div>

      {/* Résumé accords — uniquement à l'impression, si option activée */}
      {(printChordDiagramsOverride ?? user?.printChordDiagrams) && instrumentId !== 'voice' && (
        <div className="hidden print:block mb-8 print-chord-summary">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{t('chordsUsed')}</h2>
            <div className="flex-1 h-px bg-[var(--line)]" />
          </div>
          <ChordSummary
            sections={displaySections}
            instrumentId={instrumentId}
            customChords={sheet.customChords as CustomChordMap}
            capo={sheet.capo ?? 0}
            compact
            onVariantChange={(chordName, chord) =>
              setSelectedChords(prev => ({ ...prev, [chordName]: chord }))
            }
          />
        </div>
      )}

      {/* Sections — masquées pour Voix */}
      <div className={`space-y-8 print:space-y-6 ${instrumentId === 'voice' && lyrics ? 'hidden' : ''}`}>
        {(() => {
          const seenSignatures = new Map<string, string>(); // signature → label de la première occurrence
          return displaySections.map((section) => {
            const sig = sectionSignature(section);
            const firstLabel = seenSignatures.get(sig);
            const isDuplicate = minimizeRepeated && !!firstLabel;
            const isDuplicateForPrint = (printMinimizeRepeatedSectionsOverride ?? user?.printMinimizeRepeatedSections ?? false) && !!firstLabel;
            if (!seenSignatures.has(sig)) seenSignatures.set(sig, section.label);
            return { section, isDuplicate, isDuplicateForPrint, firstLabel: firstLabel ?? null };
          });
        })().map(({ section, isDuplicate, isDuplicateForPrint, firstLabel }, sectionIdx) => (
          <div key={section.id} className="print:break-inside-avoid" data-section-id={section.id}>
            {/* Header de section */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold uppercase tracking-wider text-[var(--ink)]">
                {section.label}
              </span>
              {section.repeat > 1 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent)] text-white">
                  ×{section.repeat}
                </span>
              )}
              {(isDuplicate || isDuplicateForPrint) && firstLabel && (
                <span className="hidden print:inline text-sm text-[var(--ink-light)] italic">
                  = {firstLabel}
                </span>
              )}
              <button
                onClick={() => {
                  if (isPlaying && activeStep?.sectionId === section.id) stop();
                  else playSection(section.id);
                }}
                className={`print:hidden ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border
                  ${isPlaying && activeStep?.sectionId === section.id
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                title={isPlaying && activeStep?.sectionId === section.id ? 'Stop' : t('playSection')}
              >
                {isPlaying && activeStep?.sectionId === section.id ? (
                  <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg>Stop</>
                ) : (
                  <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>Play</>
                )}
              </button>
            </div>

            {/* Grille — masquée à l'écran si doublon en mode minimisé, masquée à l'impression si option profil */}
            {isDuplicate && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--line)] text-xs text-[var(--ink-faint)] print:hidden">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('sameAs')} <span className="font-medium text-[var(--ink-light)] uppercase tracking-wide ml-0.5">{firstLabel}</span>
              </div>
            )}
            <div className={`space-y-2 ${isDuplicate ? 'hidden print:block' : ''} ${isDuplicateForPrint ? 'print:hidden' : ''}`}>
              {section.rows.map((row, rowIndex) => {
                if (row.every(c => !c.chord)) return null;

                const rowRepeat = section.rowRepeats?.[rowIndex] ?? 1;
                const isRowActive =
                  isPlaying &&
                  activeStep?.sectionId === section.id &&
                  activeStep?.rowIndex === rowIndex;
                const isRowConcertActive = !!concertCellPath &&
                  concertCellPath.sectionIdx === sectionIdx &&
                  concertCellPath.rowIdx === rowIndex;

                // Index de répétition courant (solo ou concert)
                const activeRepeatIdx = isRowActive
                  ? activeStep!.rowRepeatIndex
                  : isRowConcertActive
                    ? (concertCellPath!.rowRepeatIndex ?? 0)
                    : undefined;
                // Passage courant remonté par le suivi micro pour cette mesure (décompte des répétitions).
                const recRow = recActiveRows.find(r => r.rowId === `${section.id}-${rowIndex}`);
                // Passage courant : lecture (solo/concert) OU suivi micro.
                const currentRepeatIdx = activeRepeatIdx ?? recRow?.repeatIndex;
                const isRepeatBadgeActive = currentRepeatIdx !== undefined;
                const isLastRepeat = isRepeatBadgeActive && currentRepeatIdx === rowRepeat - 1;

                return (
                  <div key={rowIndex} className="relative" data-row-id={`${section.id}-${rowIndex}`}>
                    <div
                      className="grid gap-1 w-full measure-row"
                      style={{ gridTemplateColumns: `repeat(16, minmax(0, 1fr))` }}
                    >
                      {row.map((cell, cellIndex) => {
                        const isActive = isRowActive && activeStep?.cellIndex === cellIndex;

                        if (!cell.chord) {
                          return (
                            <div
                              key={cellIndex}
                              style={{ gridColumn: `span ${spanToGridCols(cell.span)}` }}
                            />
                          );
                        }

                        const isConcertActive = !!concertCellPath &&
                          concertCellPath.sectionIdx === sectionIdx &&
                          concertCellPath.rowIdx === rowIndex &&
                          concertCellPath.cellIdx === cellIndex;

                        return (
                          <ViewerChordCell
                            key={cellIndex}
                            pos={`${section.id}:${rowIndex}:${cellIndex}`}
                            chord={cell.chord}
                            span={cell.span}
                            isActive={isActive}
                            isConcertActive={isConcertActive}
                            concertCellDurationMs={isConcertActive ? concertCellPath?.durationMs : undefined}
                            activeStep={activeStep}
                            instrumentId={instrumentId}
                            customChords={sheet.customChords as Record<string, CustomChord> | undefined}
                            selectedChords={selectedChords}
                            translate={translate}
                            getColor={getColor}
                            showInlineDiagram={showInlineDiagram}
                            capo={effectiveCapo}
                          />
                        );
                      })}
                    </div>
                    {rowRepeat > 1 && !isLastRepeat && (
                      <span className={`absolute top-1/2 -translate-y-1/2 z-10 print:inline
                        right-0 translate-x-1/2 md:translate-x-[calc(100%+6px)]
                        print:right-0 print:translate-x-1/2
                        text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm
                        ${isRepeatBadgeActive ? 'animate-repeat-blink' : 'bg-[var(--accent)] text-white'}`}>
                        ×{isRepeatBadgeActive ? rowRepeat - currentRepeatIdx! : rowRepeat}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Suivi micro (suivi de position + défilement) — bouton flottant */}
      {instrumentId !== 'voice' && (
        <LiveChordFollow
          sequence={followSequence}
          bpm={parseTempo(localTempo) || bpm || 90}
          onListeningChange={setRecListening}
          onActiveRowsChange={setRecActiveRows}
          onAdvance={playAccompanimentChord}
          outputActive={grooveEnabled}
        />
      )}

      {/* Paroles — visibles uniquement en mode Voix */}
      {lyrics && instrumentId === 'voice' && (
        <div className="mt-10 print:mt-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{t('lyrics')}</h2>
            <div className="flex-1 h-px bg-[var(--line)]" />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[0.95rem] text-[var(--ink)] leading-loose bg-[var(--cell-bg)] rounded-lg border border-[var(--line)] p-6">
            {lyrics}
          </pre>
        </div>
      )}

    </div>
  );
}

// ─── Cellule d'accord interactive (hover → diagramme + play) ─────────────────

function resolveCustomChord(
  chordName: string,
  instrumentId: InstrumentId,
  customChords?: Record<string, CustomChord>,
): (StringChord | PianoChord) | null {
  if (!customChords) return null;
  const key = `${chordName.toLowerCase()}-${instrumentId}`;
  const custom = customChords[key];
  if (!custom) return null;
  return isPianoChord(custom as StringChord | PianoChord)
    ? (custom as unknown as PianoChord)
    : (custom as unknown as StringChord);
}

function ViewerChordCell({
  pos,
  chord,
  span,
  isActive,
  isConcertActive,
  concertCellDurationMs,
  activeStep,
  instrumentId,
  customChords,
  selectedChords,
  translate,
  getColor,
  showInlineDiagram,
  capo = 0,
}: {
  pos?: string;
  chord: string;
  span: CellSpan;
  isActive: boolean;
  isConcertActive?: boolean;
  concertCellDurationMs?: number;
  activeStep: PlayStep | null;
  instrumentId: InstrumentId;
  customChords?: Record<string, CustomChord>;
  selectedChords?: Record<string, StringChord | PianoChord>;
  translate: (name: string) => string;
  getColor: (chord: string) => { border: string; bg: string } | null;
  showInlineDiagram: boolean;
  capo?: number;
}) {
  const t = useTranslations('SheetViewer');
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pour le piano, le capo décale la hauteur → chercher l'accord transposé
  const lookupChord = instrumentId === 'piano' && capo > 0 ? transposeChord(chord, capo) : chord;
  // Pour la basse, afficher uniquement la fondamentale (ex: Cmaj7 → C)
  const bassRoot = instrumentId === 'bass' ? (lookupChord.match(/^([A-G][#b]?)/)?.[1] ?? lookupChord) : null;
  const custom = resolveCustomChord(lookupChord, instrumentId, customChords);
  const libraryVariants = useChordVariants(lookupChord, instrumentId);

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 200);
  };
  const color = getColor(chord);

  // selectedChords reflète la variante naviguée dans ChordSummary (priorité sur tout)
  const selected = selectedChords?.[chord];

  // Résoudre la variante à afficher — même logique que ChordSummary :
  // 1. Navigation en cours (selectedChords)
  // 2. Préférence auteur si toujours présente dans la bibliothèque
  // 3. Préférence auteur si accord vraiment custom (isExplicitlyCreated)
  // 4. Fallback : première variante de la bibliothèque
  const displayChord = (() => {
    if (selected) return selected;
    if (custom) {
      const inLib = libraryVariants.find(v => v.id === custom.id);
      if (inLib) return inLib;
      const rawCustom = customChords?.[`${lookupChord.toLowerCase()}-${instrumentId}`];
      if (rawCustom?.isExplicitlyCreated) return custom;
      return libraryVariants[0] ?? null;
    }
    return libraryVariants[0] ?? null;
  })();

  const playableChord = displayChord;
  const minSpanForInline = instrumentId === 'piano' ? 1 : 0.5;
  const inlineDiagramChord = showInlineDiagram && span >= minSpanForInline ? displayChord : null;
  const numStrings = INSTRUMENT_CONFIG[instrumentId]?.strings ?? 6;

  return (
    // Son réel entendu au micro = forme d'accord affichée + capo effectif
    // (0 si le joueur a désactivé le capo). Sans capo, chord inchangé.
    <div
      {...(isConcertActive ? { 'data-concert-active': '' } : {})}
      data-pos={pos}
      data-chord={capo > 0 ? transposeChord(chord, capo) : chord}
      style={{
        gridColumn: `span ${spanToGridCols(span)}`,
        ...(color ? { borderColor: color.border, borderLeftWidth: '5px' } : {}),
        ...((isActive || isConcertActive) && !color ? { borderColor: 'var(--accent)' } : {}),
      }}
      className={`
        chord-cell relative rounded-lg border-2 min-h-12 flex items-center justify-center
        bg-[var(--cell-bg)] border-[var(--line)]
        ${span <= 0.5 ? 'opacity-70' : ''}
        ${isActive && !color ? 'border-[var(--accent)]' : ''}
        print:min-h-10 print:border
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Sweep animation — lecture normale */}
      {isActive && activeStep && (
        <div
          className="absolute inset-0 origin-left pointer-events-none"
          style={{
            background: color ? color.border.substring(0, 7) + '66' : 'rgba(200,75,47,0.13)',
            animation: `beatSweep ${activeStep.durationMs}ms linear forwards`,
          }}
        />
      )}
      {/* Sweep animation — mode concert batteur (même rendu que le play natif) */}
      {isConcertActive && (concertCellDurationMs ?? 0) > 0 && (
        <div
          className="absolute inset-0 origin-left pointer-events-none"
          style={{
            background: color ? color.border.substring(0, 7) + '66' : 'rgba(200,75,47,0.13)',
            animation: `beatSweep ${concertCellDurationMs}ms linear forwards`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-1 py-1">
        <span className={`chord-name font-mono font-medium text-[var(--ink)] ${span <= 0.5 ? 'text-sm' : 'text-base'} print:text-sm`}>
          {bassRoot ? translate(bassRoot) : translate(lookupChord)}
        </span>
        {/* Diagramme inline — cliquable pour jouer, avec overlay ▶ au survol */}
        {inlineDiagramChord && (
          <div
            className="group/play relative cursor-pointer print:hidden"
            onClick={(e) => {
              e.stopPropagation();
              if (playableChord) playChord(playableChord, instrumentId, capo);
            }}
            title={t('clickToListen')}
          >
            {!isPianoChord(inlineDiagramChord) ? (
              <ChordDiagram chord={inlineDiagramChord} size="xs" numStrings={numStrings} />
            ) : (
              <PianoKeyboard chord={inlineDiagramChord} />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity rounded bg-[var(--ink)]/10 print:hidden">
              <span className="text-[var(--ink)] text-xs opacity-70">▶</span>
            </div>
          </div>
        )}
      </div>

      {span <= 0.5 && (
        <span className="absolute bottom-0.5 left-1 text-[8px] text-[var(--ink-faint)] font-mono print:hidden">
          {span === 0.25 ? '¼' : '½'}
        </span>
      )}

      {/* Popup diagramme au survol — seulement si l'option inline est désactivée */}
      {hovered && (!showInlineDiagram || span < minSpanForInline) && displayChord && (
        <div
          className="print:hidden absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-[var(--cell-bg)] rounded-xl shadow-lg border border-[var(--line)] p-3 min-w-[140px]">
            <div
              className="group/play relative flex justify-center cursor-pointer"
              onClick={(e) => { e.stopPropagation(); playChord(displayChord, instrumentId, capo); }}
              title={t('clickToListen')}
            >
              {!isPianoChord(displayChord) ? (
                <ChordDiagram chord={displayChord} size="sm" numStrings={numStrings} />
              ) : (
                <PianoKeyboard chord={displayChord} />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity rounded-lg bg-[var(--ink)]/10">
                <span className="text-[var(--ink)] text-sm opacity-70">▶</span>
              </div>
            </div>
            <div className="text-center mt-2 text-sm font-medium text-[var(--ink)]">
              {translate(lookupChord)}
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 bg-[var(--cell-bg)] border-[var(--line)] border-l border-t transform rotate-45" />
        </div>
      )}
    </div>
  );
}
