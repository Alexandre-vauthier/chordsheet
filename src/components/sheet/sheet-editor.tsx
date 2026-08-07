'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { transposeKey } from '@/lib/transpose';
import { detectKey } from '@/lib/key-detection';
import { useTranslations } from 'next-intl';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { computeDifficulty } from '@/lib/compute-difficulty';
import type { Sheet, Section, NewSheet, StringChord, PianoChord, CustomChord, InstrumentId } from '@/types';
import { createEmptySection, createEmptyRow, GENRES } from '@/types';
import { SectionBlock } from './section-block';
import { Button } from '@/components/ui/button';
import { InstrumentSelector, ChordSummary, ChordEditorModal } from '@/components/chord';
import type { CustomChordMap } from '@/components/chord';
import { usePlayback, parseTempo, grooveBpmFor, ACCOMPANIMENT_INSTRUMENTS, type PlayStyle, type PlaybackVoice } from '@/lib/use-playback';
import { useGrooveBox } from '@/lib/use-groove-box';
import { PlaybackInstrumentsMenu, GrooveBoxMenu } from './playback-menus';
import { stopPreviewAudio } from '@/lib/preview-audio';
import { CoachMark } from './coach-mark';
import { getChordsByInstrument, getAllExtendedChords } from '@/lib/chord-data';
import { useLibraryChords, libraryKey } from '@/lib/library-chords-context';
import { useAuth } from '@/lib/auth-context';
import { swapSelectorVoice } from '@/lib/accompaniment';
import { usePublicArtistSuggestions } from '@/lib/use-search-suggestions';
import { useGenreLabel } from '@/lib/use-genre-labels';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useArtwork } from '@/lib/use-artwork';
import { useSongBpm } from '@/lib/use-song-bpm';
import { SuggestionsDropdown } from '@/components/ui/suggestions-dropdown';
import { Link } from '@/i18n/navigation';
import { useChordDictation } from '@/lib/use-chord-dictation';
import { applyDictatedChord, undoDictatedChord } from '@/lib/chord-dictation';
import { DictationBar } from './dictation-bar';
import { StructurePanel } from '@/components/sheet/structure-panel';
import { Switch } from '@/components/ui/toggle';
import { deroulerStructure, structureUtile } from '@/lib/sheet-structure';

// Filtre local pour les grilles privées de l'utilisateur (petit lot déjà chargé,
// pas besoin d'une requête Firestore dédiée par frappe).
function filterOwnArtistNames(names: string[], value: string, max = 6): string[] {
  const q = value.trim().toLowerCase();
  if (q.length < 2) return [];
  return names.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, max);
}

interface SheetEditorProps {
  initialSheet: NewSheet | Sheet;
  onSave: (sheet: NewSheet | Sheet) => Promise<void>;
  isSaving?: boolean;
  // Persistance immédiate des paroles récupérées automatiquement (lyrics.ovh),
  // sans attendre un Enregistrer manuel. Fournie en mode édition (grille déjà
  // créée avec un id) pour que la consultation propose la Voix.
}

// ─── Composant paroles ────────────────────────────────────────────────────────

function LyricsEditor({
  lyrics,
  artist,
  title,
  onChange,
}: {
  lyrics: string;
  artist: string;
  title: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('Editor');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLyrics = async (a = artist, songTitle = title) => {
    if (!a.trim() || !songTitle.trim()) {
      setFetchError(t('artistTitleRequired'));
      return;
    }
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/lyrics?artist=${encodeURIComponent(a.trim())}&title=${encodeURIComponent(songTitle.trim())}`,
      );
      const data = await res.json();
      if (data.lyrics) {
        // On remplit le champ, rien de plus : l'écriture en base n'a lieu que si
        // l'auteur enregistre. Auparavant les paroles étaient persistées d'office,
        // ce qui faisait de l'application — et non de l'utilisateur — celle qui
        // publiait un texte sous droits.
        onChange(data.lyrics.trim());
      } else {
        setFetchError(t('lyricsNotFound'));
      }
    } catch {
      setFetchError(t('lyricsOvhError'));
    } finally {
      setFetching(false);
    }
  };

  // Pas de récupération automatique au montage : elle remplissait la grille sans
  // que personne ne l'ait demandé. Le bouton ci-dessous reste, à la main de l'auteur.

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{t('lyricsHeading')}</h2>
        <div className="flex-1 h-px bg-[var(--line)]" />
        <button
          type="button"
          onClick={() => fetchLyrics()}
          disabled={fetching}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
        >
          {fetching ? t('fetchingLyrics') : t('fetchLyrics')}
        </button>
      </div>
      {fetchError && (
        <p className="text-xs text-red-600 mb-2">{fetchError}</p>
      )}
      <textarea
        value={lyrics}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('lyricsPlaceholder')}
        rows={16}
        className="w-full px-4 py-3 rounded-lg border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)] text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] placeholder:text-[var(--ink-faint)]"
      />
    </div>
  );
}

/**
 * Témoin d'attente d'un champ.
 *
 * La recherche du tempo et de la tonalité passe par un service externe et demande
 * plusieurs secondes : sans rien à l'écran, on croit que rien ne se passe et on
 * remplit à la main. Un texte explicite avait été essayé, il déformait la ligne
 * d'outils — d'où ce cercle de douze pixels, qui ne déplace rien et disparaît de
 * lui-même, que la recherche aboutisse ou non.
 */
function FieldSpinner({ label }: { label: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="inline-block w-3 h-3 shrink-0 rounded-full border-[1.5px] border-[var(--line)]
        border-t-[var(--accent)] animate-spin"
    />
  );
}

export function SheetEditor({ initialSheet, onSave, isSaving = false }: SheetEditorProps) {
  const t = useTranslations('Editor');
  const tSection = useTranslations('SectionLabels');
  const genreLabel = useGenreLabel();
  const { user, updateUser, isAdmin } = useAuth();
  const frenchDetectedRef = useRef(false);
  const handleFrenchDetected = useCallback(() => {
    if (frenchDetectedRef.current || user?.notationPreference === 'french') return;
    frenchDetectedRef.current = true;
    updateUser({ notationPreference: 'french' });
  }, [user, updateUser]);

  const [sheet, setSheet] = useState<NewSheet | Sheet>(initialSheet);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [grooveEnabled, setGrooveEnabled] = useState(false);

  // Grille en cours de création (jamais enregistrée) : la première mesure porte des
  // accords en filigrane pour montrer où se remplit la grille. Volontairement distinct
  // de `isFirstSheet` ci-dessous, qui ne se déclenche qu'une fois par navigateur.
  const isNewSheet = !('id' in initialSheet);

  // Onboarding première grille
  const [isFirstSheet, setIsFirstSheet] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !('id' in initialSheet) && !localStorage.getItem('chordsheet_first_sheet_done');
  });
  const dismissOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.setItem('chordsheet_first_sheet_done', '1');
    setIsFirstSheet(false);
  }, []);

  // Tooltips premier survol (tonalité, référence)
  const [keyTooltip, setKeyTooltip] = useState(false);
  const [refTooltip, setRefTooltip] = useState(false);
  const handleKeyHover = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('chordsheet_tt_key')) {
      localStorage.setItem('chordsheet_tt_key', '1');
      setKeyTooltip(true);
      setTimeout(() => setKeyTooltip(false), 4000);
    }
  };
  const handleRefHover = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('chordsheet_tt_ref')) {
      localStorage.setItem('chordsheet_tt_ref', '1');
      setRefTooltip(true);
      setTimeout(() => setRefTooltip(false), 4000);
    }
  };

  // Playback
  // Instruments de la préécoute de l'éditeur. Choix de session : il n'est plus
  // enregistré dans la grille, la consultation repartant systématiquement de
  // l'instrument du lecteur. `null` = pas encore touché, on suit le sélecteur.
  const [pbOverride, setPbOverride] = useState<Record<string, PlayStyle> | null>(null);
  const defaultPbInst: InstrumentId = (sheet.instrumentId && ACCOMPANIMENT_INSTRUMENTS.includes(sheet.instrumentId))
    ? sheet.instrumentId : 'guitar';

  // Tant que l'auteur n'a pas touché au menu (`pbOverride` null), la préécoute suit
  // le sélecteur de fait. Une fois qu'il y a touché, on remplace explicitement la
  // voix venue du sélecteur pour que le Play continue de suivre, sans perdre les
  // instruments ajoutés à côté.
  const [pbSelectorVoice, setPbSelectorVoice] = useState<InstrumentId>(defaultPbInst);
  if (pbSelectorVoice !== defaultPbInst) {
    const previous = pbSelectorVoice;
    setPbSelectorVoice(defaultPbInst);
    setPbOverride((prev) => (prev === null ? prev : swapSelectorVoice(prev, previous, defaultPbInst)));
  }

  const displayPbMap: Record<string, PlayStyle> = pbOverride ?? { [defaultPbInst]: 'block' };

  const togglePbInstrument = (inst: InstrumentId) => {
    const next = { ...displayPbMap };
    if (inst in next) delete next[inst]; else next[inst] = 'block';
    setPbOverride(next);
  };
  const setPbStyle = (inst: InstrumentId, style: PlayStyle) => setPbOverride({ ...displayPbMap, [inst]: style });

  // usePlayback relit les voix via une ref : le Play réagit en direct au menu.
  const playbackVoices = useMemo<PlaybackVoice[] | undefined>(
    () => (Object.entries(displayPbMap) as [InstrumentId, PlayStyle][])
      .filter(([id]) => ACCOMPANIMENT_INSTRUMENTS.includes(id))
      .map(([id, style]) => ({ id, style })),
    [displayPbMap],
  );

  /**
   * En édition on travaille par défaut sur les sections distinctes : c'est là
   * qu'on corrige un accord une seule fois. La vue déroulé montre le morceau tel
   * qu'il se lira, pour vérifier l'ordre sans quitter l'éditeur.
   */
  const [vueEdition, setVueEdition] = useState<'grid' | 'flow'>('grid');

  // Le déroulé affiché en édition. En vue « grille harmonique », c'est l'ordre
  // simple des sections : la lecture et le surlignage suivent alors l'écran, comme
  // en consultation.
  const blocsEdition = useMemo(
    () => deroulerStructure(sheet.sections, vueEdition === 'flow' ? sheet.structure : undefined),
    [sheet.sections, sheet.structure, vueEdition],
  );

  const { isPlaying, activeStep, playFromBloc, playRow, togglePlay, stop, debutRef } = usePlayback({
    sections: sheet.sections,
    structure: vueEdition === 'flow' ? sheet.structure : undefined,
    tempo: sheet.tempo,
    tempoUnit: sheet.tempoUnit,
    instrumentId: sheet.instrumentId || 'guitar',
    playbackInstruments: playbackVoices,
    chordsEnabled: playbackVoices ? playbackVoices.length > 0 : true,
    customChords: sheet.customChords as Record<string, unknown>,
    metronomeEnabled,
    capo: sheet.capo ?? 0,
  });

  const bpm = parseTempo(sheet.tempo);
  const grooveBpm = grooveBpmFor(sheet.tempo, sheet.tempoUnit);

  // Prévisualisation d'un pattern (indépendante du Play général) : joue 2 mesures
  // du pattern sélectionné dans le menu déroulant, puis s'arrête toute seule.
  const [previewPattern, setPreviewPattern] = useState<string | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current); }, []);
  useEffect(() => { if (isPlaying) setPreviewPattern(null); }, [isPlaying]);

  const togglePreviewPattern = useCallback((patternId: string) => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    setPreviewPattern((current) => {
      if (current === patternId) return null;
      const measureSeconds = (60 / grooveBpm) * (sheet.beatsPerMeasure ?? 4);
      previewTimeoutRef.current = setTimeout(() => setPreviewPattern(null), measureSeconds * 2 * 1000);
      return patternId;
    });
  }, [grooveBpm, sheet.beatsPerMeasure]);

  useGrooveBox({
    // Même point de départ que les accords (voir la consultation).
    debutRef,
    enabled: isPlaying || previewPattern !== null,
    muted: previewPattern !== null ? false : !grooveEnabled,
    bpm: grooveBpm,
    beatsPerMeasure: sheet.beatsPerMeasure ?? 4,
    genres: sheet.genres ?? [],
    groovePattern: previewPattern ?? sheet.groovePattern,
  });

  // Pool d'accords indexé par instrument pour le chord finder
  const { overrides, additions } = useLibraryChords();
  const finderChordPool = useMemo(() => {
    const INSTR = ['guitar', 'ukulele', 'mandolin', 'banjo', 'piano'] as InstrumentId[];
    const pool: Record<string, (StringChord | PianoChord)[]> = {};
    for (const inst of INSTR) {
      const statics = inst === 'piano'
        ? getChordsByInstrument(inst)
        : [...getChordsByInstrument(inst), ...getAllExtendedChords(inst)];
      const instChords: (StringChord | PianoChord)[] = [];
      for (const chord of statics) {
        const key = libraryKey(chord.name, inst);
        const ov = overrides.get(key);
        instChords.push(ov ? ov.chord : chord);
      }
      additions.filter(a => a.instrumentId === inst).forEach(a => instChords.push(a.chord));
      pool[inst] = instChords;
    }
    return pool as Record<InstrumentId, (StringChord | PianoChord)[]>;
  }, [overrides, additions]);

  // Alerte si l'utilisateur quitte sans sauvegarder (refresh / fermeture onglet)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  // Stopper la prévisualisation iTunes au démontage (changement de page)
  useEffect(() => {
    return () => { stopPreviewAudio(); };
  }, []);

  // Recalculer la difficulté automatiquement à chaque changement de sections
  useEffect(() => {
    const auto = computeDifficulty(sheet.sections);
    setSheet(prev => ({ ...prev, difficulty: auto }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.sections]);

  // État pour la modal d'édition d'accord
  const [chordModalOpen, setChordModalOpen] = useState(false);
  const [editingChordName, setEditingChordName] = useState('');
  const [editingChord, setEditingChord] = useState<StringChord | PianoChord | null>(null);

  // Vérifier si la grille a au moins un accord
  const hasAtLeastOneChord = () => {
    return sheet.sections.some(section =>
      section.rows.some(row =>
        row.some(cell => cell.chord.trim() !== '')
      )
    );
  };

  // Valider la grille avant sauvegarde
  const validateSheet = (): string | null => {
    if (!sheet.title.trim()) {
      return t('titleRequired');
    }
    if (!sheet.artist.trim()) {
      return t('artistRequired');
    }
    if (!hasAtLeastOneChord() && !sheet.lyrics?.trim()) {
      return t('chordsOrLyricsRequired');
    }
    return null;
  };

  const updateSheet = useCallback((updates: Partial<NewSheet | Sheet>) => {
    setSheet((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // Année : suggestion iTunes (releaseDate). Pré-remplit le champ s'il est vide et
  // que l'utilisateur n'y a pas touché ; jamais d'écrasement d'une valeur saisie.
  const yearTouchedRef = useRef(false);
  // Recherche iTunes (année / genre / pochette) déclenchée seulement quand le titre ET
  // l'artiste sont saisis, à la SORTIE d'un des deux champs (blur) — jamais au fil de
  // la frappe. triggerArtworkLookup() est appelé sur les onBlur des inputs concernés.
  const [lookupKey, setLookupKey] = useState<{ title: string; artist: string } | null>(null);
  const triggerArtworkLookup = () => {
    const ti = sheet.title.trim();
    const ar = sheet.artist.trim();
    if (ti && ar) setLookupKey({ title: ti, artist: ar });
  };
  const { year: suggestedYear, genre: suggestedGenre } = useArtwork(lookupKey?.artist, lookupKey?.title);
  useEffect(() => { yearTouchedRef.current = false; }, [sheet.title, sheet.artist]);
  useEffect(() => {
    if (!yearTouchedRef.current && sheet.year == null && suggestedYear != null) {
      updateSheet({ year: suggestedYear });
    }
  }, [suggestedYear, sheet.year, updateSheet]);

  // Genre : suggestion iTunes (primaryGenreName mappé). Coché automatiquement si le
  // champ genres est vide et non modifié ; éditable ensuite (checkboxes de genre).
  const genreTouchedRef = useRef(false);
  useEffect(() => { genreTouchedRef.current = false; }, [sheet.title, sheet.artist]);
  useEffect(() => {
    if (!genreTouchedRef.current && (sheet.genres?.length ?? 0) === 0
        && suggestedGenre && (GENRES as readonly string[]).includes(suggestedGenre)) {
      genreTouchedRef.current = true;
      updateSheet({ genres: [suggestedGenre] });
    }
  }, [suggestedGenre, sheet.genres, updateSheet]);

  // BPM + tonalité (GetSongBPM), même déclencheur (lookupKey au blur). Remplis
  // automatiquement si le champ est vide et non modifié ; éditables ensuite.
  const {
    tempo: suggestedTempo,
    songKey: suggestedKey,
    searching: bpmSearching,
    notFound: bpmNotFound,
  } = useSongBpm(lookupKey?.artist, lookupKey?.title);
  const tempoTouchedRef = useRef(false);
  const keyTouchedRef = useRef(false);
  useEffect(() => { tempoTouchedRef.current = false; keyTouchedRef.current = false; }, [sheet.title, sheet.artist]);
  useEffect(() => {
    if (!tempoTouchedRef.current && !sheet.tempo.trim() && suggestedTempo != null) {
      tempoTouchedRef.current = true;
      updateSheet({ tempo: String(suggestedTempo) });
    }
  }, [suggestedTempo, sheet.tempo, updateSheet]);
  /**
   * La tonalité d'une grille est celle de ses **accords écrits**, pas celle de
   * l'enregistrement.
   *
   * C'est la seule définition cohérente avec le reste de la page : les accords, les
   * diagrammes, la transposition et le suivi au micro sont tous dans ce domaine. Une
   * tonalité venue d'ailleurs serait le seul élément qui ne correspond à rien de
   * visible. Ce qui sonne se déduit du capo, qui est déjà affiché.
   *
   * Les accords font donc autorité, et le service externe ne sert qu'à amorcer une
   * grille encore vide — sa réponse étant celle de l'enregistrement, on lui retire le
   * capo pour la ramener dans le bon domaine.
   */
  const deducedKey = useMemo(() => {
    const suite: string[] = [];
    for (const section of sheet.sections ?? []) {
      for (const row of section.rows ?? []) {
        for (const cell of row) if (cell.chord?.trim()) suite.push(cell.chord.trim());
      }
    }
    // Deux couleurs distinctes suffisent : beaucoup de morceaux tiennent en deux
    // accords, et la déduction sait les traiter — elle pondère alors la position du
    // premier accord plus fort, faute d'harmonie à lire.
    if (new Set(suite.map((c) => c.toLowerCase())).size < 2) return null;
    return detectKey(suite)?.key ?? null;
  }, [sheet.sections]);

  useEffect(() => {
    if (keyTouchedRef.current) return;

    // Les accords priment. À défaut, la réponse du service, ramenée aux positions.
    const proposee = deducedKey
      ?? (suggestedKey ? transposeKey(suggestedKey, -(sheet.capo ?? 0)) : null);

    if (proposee && proposee !== sheet.key) updateSheet({ key: proposee });
  }, [deducedKey, suggestedKey, sheet.capo, sheet.key, updateSheet]);

  // Mettre à jour une section
  const updateSection = useCallback((sectionId: string, updates: Partial<Section>) => {
    setSheet((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    }));
    setHasChanges(true);
  }, []);

  // Supprimer une section
  const deleteSection = useCallback((sectionId: string) => {
    if (!confirm(t('confirmDeleteSection'))) return;
    setSheet((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
      // Ses passages partent avec elle : une structure qui cite une section
      // disparue se déroule quand même, mais le panneau afficherait des lignes
      // orphelines qu'on ne saurait plus nommer.
      structure: prev.structure?.filter((e) => e.sectionId !== sectionId),
    }));
    setHasChanges(true);
  }, [t]);

  // Ajouter une section
  const addSection = useCallback(() => {
    const sectionLabels = ['Intro', 'Couplet', 'Refrain', 'Bridge', 'Pré-refrain', 'Outro', 'Solo'].map((l) => tSection(l));
    const usedLabels = sheet.sections.map((s) => s.label);
    const nextLabel = sectionLabels.find((l) => !usedLabels.includes(l)) || tSection('Section');
    const newSection = createEmptySection(nextLabel);

    setSheet((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setHasChanges(true);
  }, [sheet.sections, tSection]);

  // Dupliquer une section
  const duplicateSection = useCallback((sectionId: string) => {
    setSheet((prev) => {
      const idx = prev.sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) return prev;
      const source = prev.sections[idx];
      const clone: Section = {
        ...source,
        id: crypto.randomUUID(),
        label: `${source.label}${t('copySuffix')}`,
        rows: source.rows.map((row) => row.map((cell) => ({ ...cell }))),
      };
      const newSections = [...prev.sections];
      newSections.splice(idx + 1, 0, clone);
      return { ...prev, sections: newSections };
    });
    setHasChanges(true);
  }, [t]);

  // Drag & drop sections
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [structureOuverte, setStructureOuverte] = useState(false);
  const tStruct = useTranslations('Structure');
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  // Refs pour éviter les closures périmées et avoir des valeurs synchrones
  const dragSectionIdRef = useRef<string | null>(null);
  const [anyDragging, setAnyDragging] = useState(false);

  const wheelCleanupRef = useRef<(() => void) | null>(null);

  const handleDragStart = useCallback((sectionId: string) => {
    dragSectionIdRef.current = sectionId;
    setDragSectionId(sectionId);
    setAnyDragging(true);
    // Permettre le scroll à la molette pendant le drag
    const onWheel = (e: WheelEvent) => { window.scrollBy(0, e.deltaY); };
    window.addEventListener('wheel', onWheel, { passive: true });
    wheelCleanupRef.current = () => window.removeEventListener('wheel', onWheel);
  }, []);

  const handleDragOver = useCallback((sectionId: string) => {
    setDragOverSectionId(sectionId);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragSectionIdRef.current = null;
    setDragSectionId(null);
    setDragOverSectionId(null);
    setAnyDragging(false);
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
  }, []);

  const handleDrop = useCallback((targetSectionId: string) => {
    const fromId = dragSectionIdRef.current;
    if (!fromId || fromId === targetSectionId) {
      dragSectionIdRef.current = null;
      setDragSectionId(null);
      setDragOverSectionId(null);
      return;
    }
    setSheet((prev) => {
      const sections = [...prev.sections];
      const fromIdx = sections.findIndex((s) => s.id === fromId);
      if (fromIdx === -1) return prev;
      const [moved] = sections.splice(fromIdx, 1);
      if (targetSectionId === '__end__') {
        sections.push(moved);
      } else {
        const toIdx = sections.findIndex((s) => s.id === targetSectionId);
        if (toIdx === -1) return prev;
        sections.splice(toIdx, 0, moved);
      }
      return { ...prev, sections };
    });
    setHasChanges(true);
    dragSectionIdRef.current = null;
    setDragSectionId(null);
    setDragOverSectionId(null);
  }, []);

  const moveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
    setSheet((prev) => {
      const sections = [...prev.sections];
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sections.length) return prev;
      [sections[idx], sections[targetIdx]] = [sections[targetIdx], sections[idx]];
      return { ...prev, sections };
    });
    setHasChanges(true);
  }, []);

  // Ref vers l'input artiste pour le focus via TAB depuis le titre
  const artistInputRef = useRef<HTMLInputElement>(null);
  const [artistFocused, setArtistFocused] = useState(false);
  const [activeArtistSuggestion, setActiveArtistSuggestion] = useState(-1);

  // Suggestions d'artiste : grilles publiques + grilles (privées incluses) de l'utilisateur —
  // pousse vers l'orthographe déjà existante pour éviter de fragmenter les pages artiste
  // (qui matchent aujourd'hui sur une égalité stricte, sensible à la casse).
  const [ownArtistNames, setOwnArtistNames] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    const db = getDb();
    getDocs(query(collection(db, 'sheets'), where('ownerId', '==', user.id), limit(300)))
      .then((snap) => {
        const names = Array.from(new Set(
          snap.docs.map((d) => (d.data().artist as string)?.trim()).filter((n): n is string => !!n)
        ));
        setOwnArtistNames(names);
      })
      .catch(() => {});
  }, [user]);
  const debouncedArtist = useDebouncedValue(sheet.artist);
  const publicArtistSuggestions = usePublicArtistSuggestions(debouncedArtist);
  const artistSuggestions = useMemo(
    () =>
      Array.from(new Set([...publicArtistSuggestions, ...filterOwnArtistNames(ownArtistNames, debouncedArtist)]))
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
        .slice(0, 6),
    [publicArtistSuggestions, ownArtistNames, debouncedArtist]
  );

  // Navigation entre cellules via TAB — focus la cellule cible par data-cell-id
  const navigateToCell = useCallback(
    (sectionId: string, rowIndex: number, cellIndex: number) => {
      const id = `cell-${sectionId}-${rowIndex}-${cellIndex}`;
      const el = document.querySelector<HTMLElement>(`[data-cell-id="${id}"]`);
      el?.click();
    },
    []
  );

  /* ── Dictée au micro ──────────────────────────────────────────────────────
   *
   * Le micro écrit les accords dans la grille, une cellule à la fois. La cellule
   * visée est celle qui est mise en évidence ; elle avance après chaque accord
   * validé, exactement comme le ferait Tab — y compris en créant une mesure quand
   * on arrive au bout de la section.
   */
  const [dictationTarget, setDictationTarget] = useState<
    { sectionId: string; rowIndex: number; cellIndex: number } | null
  >(null);

  // La validation lit la grille au moment où elle survient, pas au moment où le
  // micro a démarré : une ref évite de recréer l'écoute à chaque frappe.
  const sectionsRef = useRef(sheet.sections);
  useEffect(() => { sectionsRef.current = sheet.sections; }, [sheet.sections]);
  const targetRef = useRef(dictationTarget);
  useEffect(() => { targetRef.current = dictationTarget; }, [dictationTarget]);

  /** Première cellule vide de la grille : là où la dictée a le plus de sens. */
  const firstEmptyCell = useCallback(() => {
    for (const section of sheet.sections) {
      for (let r = 0; r < section.rows.length; r++) {
        for (let c = 0; c < section.rows[r].length; c++) {
          if (!section.rows[r][c].chord) return { sectionId: section.id, rowIndex: r, cellIndex: c };
        }
      }
    }
    const first = sheet.sections[0];
    return first ? { sectionId: first.id, rowIndex: 0, cellIndex: 0 } : null;
  }, [sheet.sections]);

  const writeChordAt = useCallback(
    (at: { sectionId: string; rowIndex: number; cellIndex: number }, chord: string) => {
      const section = sectionsRef.current.find((s) => s.id === at.sectionId);
      if (!section) return null;

      const result = applyDictatedChord(
        section.rows,
        { rowIndex: at.rowIndex, cellIndex: at.cellIndex },
        chord,
        createEmptyRow,
      );
      if (!result) return null;

      updateSection(section.id, { rows: result.rows });
      return { sectionId: section.id, ...result.next };
    },
    [updateSection],
  );

  const handleDictatedChord = useCallback(
    (chord: string) => {
      const at = targetRef.current;
      if (!at) return;
      const next = writeChordAt(at, chord);
      if (next) setDictationTarget(next);
    },
    [writeChordAt],
  );

  const dictation = useChordDictation(handleDictatedChord);

  /** Revenir d'une cellule et l'effacer : le rattrapage d'une détection fausse. */
  const undoDictation = useCallback(() => {
    const at = targetRef.current;
    if (!at) return;

    const section = sectionsRef.current.find((s) => s.id === at.sectionId);
    if (!section) return;

    const result = undoDictatedChord(section.rows, { rowIndex: at.rowIndex, cellIndex: at.cellIndex });
    if (!result) return;

    updateSection(section.id, { rows: result.rows });
    setDictationTarget({ sectionId: section.id, ...result.next });
  }, [updateSection]);

  const toggleDictation = useCallback(() => {
    if (dictation.listening) {
      dictation.stop();
      setDictationTarget(null);
      return;
    }
    const start = firstEmptyCell();
    if (!start) return;
    setDictationTarget(start);
    targetRef.current = start;
    dictation.start();
  }, [dictation, firstEmptyCell]);

  // Échap coupe l'écoute : un micro ouvert doit toujours pouvoir se fermer vite.
  // L'abonnement ne dépend que de l'état d'écoute — `dictation` est un objet neuf à
  // chaque rendu, s'y fier ferait poser et retirer l'écouteur à chaque frappe.
  const stopDictationRef = useRef(dictation.stop);
  useEffect(() => { stopDictationRef.current = dictation.stop; }, [dictation.stop]);

  useEffect(() => {
    if (!dictation.listening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopDictationRef.current();
        setDictationTarget(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dictation.listening]);

  // Ouvrir la modal pour éditer un accord
  const handleEditChord = useCallback((chordName: string, currentChord: StringChord | PianoChord | null) => {
    setEditingChordName(chordName);
    setEditingChord(currentChord);
    setChordModalOpen(true);
  }, []);

  // Sauvegarder un accord personnalisé
  const handleSaveCustomChord = useCallback((chord: StringChord | PianoChord) => {
    const instrumentId = sheet.instrumentId || 'guitar';
    const key = `${editingChordName.toLowerCase()}-${instrumentId}`;

    // Créer l'accord personnalisé avec l'instrumentId
    const customChord: CustomChord = {
      ...chord,
      instrumentId,
      isExplicitlyCreated: true,
    } as CustomChord;

    setSheet(prev => ({
      ...prev,
      customChords: {
        ...(prev.customChords || {}),
        [key]: customChord,
      },
    }));
    setHasChanges(true);
  }, [editingChordName, sheet.instrumentId]);

  // Sauvegarder la variante sélectionnée dans ChordSummary
  const handleVariantSelect = useCallback((chordName: string, chord: StringChord | PianoChord) => {
    const instrumentId = sheet.instrumentId || 'guitar';
    const key = `${chordName.toLowerCase()}-${instrumentId}`;
    const customChord: CustomChord = { ...chord, instrumentId } as CustomChord;
    setSheet(prev => {
      const existing = (prev.customChords as Record<string, CustomChord> | undefined)?.[key];
      if (existing?.isExplicitlyCreated) return prev;
      return {
        ...prev,
        customChords: { ...(prev.customChords || {}), [key]: customChord },
      };
    });
    setHasChanges(true);
  }, [sheet.instrumentId]);

  // Supprimer un accord personnalisé
  const handleDeleteCustomChord = useCallback((chordName: string) => {
    const instrumentId = sheet.instrumentId || 'guitar';
    const key = `${chordName.toLowerCase()}-${instrumentId}`;

    setSheet(prev => {
      const newCustomChords = { ...(prev.customChords || {}) };
      delete newCustomChords[key];
      return {
        ...prev,
        customChords: Object.keys(newCustomChords).length > 0 ? newCustomChords : undefined,
      };
    });
    setHasChanges(true);
  }, [sheet.instrumentId]);

  // Sauvegarder
  const handleSave = async () => {
    const error = validateSheet();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    await onSave(sheet);
    setHasChanges(false);
    dismissOnboarding();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Header de la chanson */}
      <div className="mb-8 border-b-2 border-[var(--ink)] pb-4">
        <div className="flex items-start justify-between gap-4">
          <input
            type="text"
            value={sheet.title}
            onChange={(e) => {
              const val = e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
              updateSheet({ title: val });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                artistInputRef.current?.focus();
              }
            }}
            onBlur={triggerArtworkLookup}
            placeholder={t('titlePlaceholder')}
            className="font-playfair text-3xl font-bold bg-transparent border-none outline-none flex-1
              caret-[var(--accent)] placeholder:text-[var(--ink-faint)]"
          />
          <div className="flex-shrink-0 flex items-center gap-2 flex-wrap justify-end">
            {/* Instrument des diagrammes (comme la consultation, en haut) */}
            <InstrumentSelector
              value={sheet.instrumentId || 'guitar'}
              onChange={(instrumentId) => updateSheet({ instrumentId })}
            />
            {/* Toggle métronome */}
            <button
              onClick={() => setMetronomeEnabled(v => !v)}
              title={metronomeEnabled ? t('disableMetronome') : t('enableMetronome')}
              className={`
                cursor-pointer flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
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
            </button>

            {/* Dictée au micro : écrit les accords joués dans la grille */}
            <button
              onClick={toggleDictation}
              title={dictation.listening ? t('dictation.stop') : t('dictation.start')}
              className={`
                cursor-pointer flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] transition-all duration-150
                ${dictation.listening
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink-light)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }
              `}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
                <line x1="12" y1="18" x2="12" y2="21" strokeLinecap="round" />
              </svg>
            </button>

            {/* Boîte à rythmes (menu comme la consultation) */}
            <GrooveBoxMenu
              enabled={grooveEnabled}
              pattern={sheet.groovePattern}
              previewingId={previewPattern}
              onNone={() => setGrooveEnabled(false)}
              onAuto={() => { setGrooveEnabled(true); updateSheet({ groovePattern: undefined }); }}
              onPattern={(id) => { setGrooveEnabled(true); updateSheet({ groovePattern: id }); }}
              onTogglePreview={togglePreviewPattern}
            />

            {/* Instruments joués (menu comme la consultation) */}
            <PlaybackInstrumentsMenu
              value={displayPbMap}
              onSetNone={() => setPbOverride({})}
              onToggle={togglePbInstrument}
              onSetStyle={setPbStyle}
            />

            {/* Play / Stop */}
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Stop' : `Play — ${bpm} BPM`}
              className={`
                cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-150 border-[1.5px]
                ${isPlaying
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[#a83d25]'
                  : 'bg-[var(--cell-bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }
              `}
            >
              {isPlaying ? (
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
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <div className="relative">
            <input
              ref={artistInputRef}
              type="text"
              value={sheet.artist}
              onChange={(e) => {
                const val = e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
                updateSheet({ artist: val });
                setActiveArtistSuggestion(-1);
              }}
              onFocus={() => setArtistFocused(true)}
              onBlur={() => { setArtistFocused(false); triggerArtworkLookup(); }}
              onKeyDown={(e) => {
                if (artistSuggestions.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveArtistSuggestion((i) => Math.min(i + 1, artistSuggestions.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveArtistSuggestion((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && activeArtistSuggestion >= 0) {
                  e.preventDefault();
                  updateSheet({ artist: artistSuggestions[activeArtistSuggestion] });
                  setActiveArtistSuggestion(-1);
                } else if (e.key === 'Escape') {
                  setActiveArtistSuggestion(-1);
                }
              }}
              placeholder={t('artistPlaceholder')}
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)]"
            />
            {artistFocused && artistSuggestions.length > 0 && (
              <SuggestionsDropdown
                items={artistSuggestions}
                activeIndex={activeArtistSuggestion}
                getKey={(name) => name}
                onHover={setActiveArtistSuggestion}
                onSelect={(name) => { updateSheet({ artist: name }); setActiveArtistSuggestion(-1); }}
                renderItem={(name) => <span className="text-[var(--ink)]">{name}</span>}
              />
            )}
          </div>
          <div className="relative flex items-center gap-1 text-[var(--ink-faint)]" onMouseEnter={isFirstSheet ? handleKeyHover : undefined}>
            <span className="text-sm">♯♭</span>
            <input
              type="text"
              value={sheet.key}
              onChange={(e) => {
                const raw = e.target.value;
                // Bloquer les chiffres
                if (/\d/.test(raw)) return;
                // Vider le champ, c'est redemander une proposition — pas imposer le
                // vide. Sans ça, effacer une tonalité la laissait absente pour de bon,
                // sans moyen de la retrouver autrement qu'en la retapant.
                keyTouchedRef.current = raw.trim().length > 0;
                // 1ère lettre : majuscule ; caractères suivants : m, #, b autorisés tels quels
                const normalized = raw.length > 0
                  ? raw.charAt(0).toUpperCase() + raw.slice(1)
                  : raw;
                updateSheet({ key: normalized });
              }}
              placeholder={t('keyPlaceholder')}
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)] w-24"
            />
            {bpmSearching && !sheet.key.trim() && <FieldSpinner label={t('bpmSearching')} />}
            {keyTooltip && (
              <CoachMark text={t('keyTooltip')} position="bottom" onDismiss={() => setKeyTooltip(false)} />
            )}
          </div>
          <span className="flex items-center gap-1 text-[var(--ink-faint)]">
            <button
              type="button"
              onClick={() => {
                const units = ['quarter', 'eighth'] as const;
                const cur = sheet.tempoUnit ?? 'quarter';
                const next = units[(units.indexOf(cur) + 1) % units.length];
                updateSheet({ tempoUnit: next });
              }}
              title={t('changeTempoUnit')}
              className="text-base leading-none hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              {sheet.tempoUnit === 'eighth' ? '♪' : '♩'}
            </button>
            <input
              type="number"
              min={40}
              max={300}
              value={sheet.tempo.replace(/\D/g, '') || ''}
              onChange={(e) => {
                tempoTouchedRef.current = true;
                const v = e.target.value.replace(/\D/g, '');
                updateSheet({ tempo: v });
              }}
              placeholder="90"
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)] w-12
                [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {bpmSearching && !sheet.tempo.trim() && <FieldSpinner label={t('bpmSearching')} />}
          </span>

          <span className="flex items-center gap-1 text-[var(--ink-faint)]" title={t('yearTooltip')}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <rect x="3" y="4.5" width="18" height="16" rx="2" />
              <path d="M3 9.5h18M8 3v3M16 3v3" strokeLinecap="round" />
            </svg>
            <input
              type="number"
              min={1900}
              max={2099}
              value={sheet.year ?? ''}
              onChange={(e) => {
                yearTouchedRef.current = true;
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                updateSheet({ year: v ? Number(v) : null });
              }}
              placeholder={t('yearPlaceholder')}
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)] w-14
                [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </span>

          <div className="relative flex items-center gap-1 text-[var(--ink-faint)]" onMouseEnter={isFirstSheet ? handleRefHover : undefined}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l6-6M10.5 6.5l1-1a3.5 3.5 0 015 5l-2 2M13.5 17.5l-1 1a3.5 3.5 0 01-5-5l2-2" />
            </svg>
            <input
              type="url"
              value={sheet.referenceUrl || ''}
              onChange={(e) => updateSheet({ referenceUrl: e.target.value })}
              placeholder={t('referencePlaceholder')}
              className="font-sans text-sm text-[var(--ink-light)] bg-transparent border-none outline-none
                placeholder:text-[var(--ink-faint)] w-64"
            />
            {refTooltip && (
              <CoachMark text={t('referenceTooltip')} position="bottom" onDismiss={() => setRefTooltip(false)} />
            )}
          </div>
        </div>
      </div>

      {/* Métadonnées */}
      <div className="mb-6 p-4 bg-[var(--cell-bg)] rounded-lg border border-[var(--line)] space-y-4">
        {/* Métrique, Capo & Difficulté */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Binaire / Ternaire */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">{t('meter')}</span>
            <div className="flex rounded overflow-hidden border border-[var(--line)]">
              <button
                onClick={() => updateSheet({
                  beatsPerMeasure: 4,
                  sections: sheet.sections.map(s => ({ ...s, beatsPerMeasure: 4 as const })),
                })}
                className={`cursor-pointer px-3 py-1 text-xs transition-colors ${
                  (sheet.beatsPerMeasure ?? 4) === 4
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('binary')}
              </button>
              <button
                onClick={() => updateSheet({
                  beatsPerMeasure: 3,
                  sections: sheet.sections.map(s => ({ ...s, beatsPerMeasure: 3 as const })),
                })}
                className={`cursor-pointer px-3 py-1 text-xs border-l border-[var(--line)] transition-colors ${
                  sheet.beatsPerMeasure === 3
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--cell-bg)] text-[var(--ink-light)] hover:bg-[var(--cell-hover)]'
                }`}
              >
                {t('ternary')}
              </button>
            </div>
          </div>
          {/* Capo */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">{t('capo')}</span>
            <select
              value={sheet.capo ?? ''}
              onChange={(e) => updateSheet({ capo: e.target.value ? Number(e.target.value) : null })}
              className="cursor-pointer px-2 py-1 rounded border border-[var(--line)] text-sm bg-[var(--cell-bg)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">{t('noCapo')}</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>{t('capoN', { n })}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Genres : label + select + tags supprimables, sur la même ligne */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--ink-light)]">{t('genres')}</span>
            <select
              value=""
              onChange={(e) => {
                const g = e.target.value;
                if (!g || (sheet.genres || []).includes(g)) return;
                genreTouchedRef.current = true;
                updateSheet({ genres: [...(sheet.genres || []), g] });
              }}
              className="cursor-pointer px-2 py-1.5 rounded border border-[var(--line)] text-sm bg-[var(--cell-bg)]
                text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">{t('addGenre')}</option>
              {GENRES.filter((genre) => !(sheet.genres || []).includes(genre)).map((genre) => (
                <option key={genre} value={genre}>{genreLabel(genre)}</option>
              ))}
            </select>
            {(sheet.genres || []).map((genre) => (
              <span
                key={genre}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs rounded-full bg-[var(--accent)] text-white"
              >
                {genreLabel(genre)}
                <button
                  type="button"
                  onClick={() => {
                    genreTouchedRef.current = true;
                    updateSheet({ genres: (sheet.genres || []).filter((g) => g !== genre) });
                  }}
                  title="Retirer"
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/25 transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Visibilité */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
          <span className="text-sm text-[var(--ink-light)]">{t('publicSheetLabel')}</span>
          <Switch
            checked={!!sheet.isPublic}
            ariaLabel={t('publicSheetLabel')}
            onChange={(goingPublic) => {
              if (goingPublic && 'forkedFrom' in sheet && sheet.forkedFrom) {
                const confirmed = confirm(t('confirmForkPublic'));
                if (!confirmed) return;
              }
              if (!goingPublic) {
                const hasSetRefs = 'unlistedBySetIds' in sheet && (sheet.unlistedBySetIds?.length ?? 0) > 0;
                updateSheet({ isPublic: false, ...(hasSetRefs ? {} : { isUnlisted: false }) });
              } else {
                updateSheet({ isPublic: true, pendingValidation: false });
              }
            }}
          />
        </div>

        {/* À valider — admin uniquement */}
        {isAdmin && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
            <div>
              <span className="text-sm text-amber-500 font-medium">{t('pendingValidation')}</span>
              <p className="text-xs text-[var(--ink-faint)] mt-0.5">{t('pendingValidationDesc')}</p>
            </div>
            <Switch
              checked={!!sheet.pendingValidation}
              ariaLabel={t('pendingValidation')}
              ton="ambre"
              onChange={(next) => updateSheet({ pendingValidation: next, ...(next ? { isPublic: false } : {}) })}
            />
          </div>
        )}
      </div>

      {/* Titre de la grille — masqué pour Voix */}
      {sheet.instrumentId !== 'voice' && (
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{t('harmonicGrid')}</h2>
          <div className="flex-1 h-px bg-[var(--line)]" />
          {/* La même bascule qu'en consultation : on vérifie l'ordre sur place,
              sans quitter l'éditeur ni ouvrir la grille dans un autre onglet. */}
          {structureUtile(sheet.sections, sheet.structure) && (
            <div className="flex items-center gap-1 print:hidden">
              {([['grid', tStruct('viewGrid')], ['flow', tStruct('viewFlow')]] as const).map(([mode, libelle]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setVueEdition(mode)}
                  aria-pressed={vueEdition === mode}
                  className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                  style={{
                    background: vueEdition === mode ? 'var(--accent)' : 'transparent',
                    borderColor: vueEdition === mode ? 'var(--accent)' : 'var(--line)',
                    color: vueEdition === mode ? '#fff' : 'var(--ink-light)',
                  }}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}
          {sheet.sections.length > 1 && (
            <button
              type="button"
              onClick={() => setStructureOuverte(true)}
              className="print:hidden text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{
                borderColor: sheet.structure?.length ? 'var(--accent)' : 'var(--line)',
                color: sheet.structure?.length ? 'var(--accent)' : 'var(--ink-light)',
              }}
            >
              {tStruct('define')}
            </button>
          )}
        </div>
      )}

      {/* Le déroulé, rappelé sous le titre : en édition on manipule des sections
          distinctes, et rien ne dirait plus dans quel ordre elles se lisent. Un
          clic rouvre le panneau. */}
      {sheet.instrumentId !== 'voice' && structureUtile(sheet.sections, sheet.structure) && (
        <button
          type="button"
          onClick={() => setStructureOuverte(true)}
          className="print:hidden w-full mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border px-3 py-2 text-left transition-colors hover:border-[var(--accent)]"
          style={{ background: 'var(--cell-bg)', borderColor: 'var(--line)' }}
        >
          {deroulerStructure(sheet.sections, sheet.structure).map((bloc, i) => (
            <span key={i} className="text-xs" style={{ color: 'var(--ink-light)' }}>
              {i > 0 && <span className="mr-1.5" style={{ color: 'var(--ink-faint)' }}>›</span>}
              {bloc.label || '—'}
              {bloc.repeat > 1 && <span className="font-semibold" style={{ color: 'var(--accent)' }}> ×{bloc.repeat}</span>}
            </span>
          ))}
        </button>
      )}

      {structureOuverte && (
        <StructurePanel
          sections={sheet.sections}
          structure={sheet.structure}
          onChange={(structure) => updateSheet({ structure })}
          onClose={() => setStructureOuverte(false)}
        />
      )}

      {/* Sections — masquées pour Voix */}
      <div className={sheet.instrumentId === 'voice' ? 'hidden' : ''}>
        {blocsEdition.map((bloc, sectionIndex) => {
          const section = bloc.section;
          const reordonnable = vueEdition === 'grid';
          const isDragging = dragSectionId === section.id;
          const draggedIdx = sheet.sections.findIndex(s => s.id === dragSectionId);
          // Ne pas afficher "Déposer ici" sur la section immédiatement après la section draggée
          // (ce serait un no-op : insérer avant B alors que A est déjà avant B)
          const isNoOpTarget = draggedIdx !== -1 && sectionIndex === draggedIdx + 1;
          // Ce passage-ci est-il celui qu'on entend ? Deux passages partagent la
          // même section : sans leur rang, les deux se surligneraient ensemble.
          const estBlocJoue = isPlaying && activeStep?.sectionId === section.id
            && activeStep.occurrence === bloc.occurrence;
          return (
            <div
              key={`${section.id}:${bloc.occurrence}`}
              className={isDragging ? 'opacity-30 pointer-events-none' : ''}
            >
              <SectionBlock
                // En déroulé, le « ×N » vient de la structure, pas de la section.
                // En déroulé, le nom et le « ×N » viennent du passage, pas de la
                // section : les mêmes accords s'appellent « Intro » ici et
                // « Refrain » plus loin.
                section={vueEdition === 'flow' ? { ...section, label: bloc.label, repeat: bloc.repeat } : section}
                reorderable={reordonnable}
                instrumentId={sheet.instrumentId || 'guitar'}
                onUpdate={(updates) => {
                  // En déroulé, le nom et le nombre de passages appartiennent au
                  // passage, pas à la section.
                  const duPassage = vueEdition === 'flow'
                    && (updates.repeat !== undefined || updates.label !== undefined);
                  if (duPassage) {
                    // Sinon on écrirait sur la section, donc sur *tous* ses
                    // passages : renommer le dernier refrain renommerait l'intro.
                    const { repeat, label, ...reste } = updates;
                    // Le rang du bloc n'est celui de l'entrée que si toutes les
                    // entrées désignent une section existante : le déroulé saute
                    // celles qui n'en désignent plus. On recompte donc.
                    const connues = new Set(sheet.sections.map((sec) => sec.id));
                    let rang = -1;
                    updateSheet({
                      structure: (sheet.structure ?? []).map((e) => {
                        if (!connues.has(e.sectionId)) return e;
                        rang += 1;
                        if (rang !== sectionIndex) return e;
                        return {
                          ...e,
                          ...(repeat !== undefined ? { repeat } : {}),
                          ...(label !== undefined ? { label } : {}),
                        };
                      }),
                    });
                    if (Object.keys(reste).length) updateSection(section.id, reste);
                    return;
                  }
                  updateSection(section.id, updates);
                }}
                onDelete={() => deleteSection(section.id)}
                onDuplicate={() => duplicateSection(section.id)}
                onPlaySection={() => {
                  if (estBlocJoue) stop();
                  else playFromBloc(sectionIndex);
                }}
                isSectionPlaying={estBlocJoue}
                onPlayRow={(rowIndex) => {
                  if (estBlocJoue && activeStep!.rowIndex === rowIndex) stop();
                  else playRow(section.id, rowIndex, bloc.occurrence);
                }}
                activeRowIndex={estBlocJoue ? activeStep!.rowIndex : undefined}
                activeCellIndex={estBlocJoue ? activeStep!.cellIndex : undefined}
                activeDurationMs={estBlocJoue ? activeStep!.durationMs : undefined}
                dictationRowIndex={dictationTarget?.sectionId === section.id ? dictationTarget.rowIndex : undefined}
                dictationCellIndex={dictationTarget?.sectionId === section.id ? dictationTarget.cellIndex : undefined}
                onNavigateToCell={navigateToCell}
                onDragStart={() => handleDragStart(section.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => { e.preventDefault(); if (dragSectionIdRef.current !== section.id) handleDragOver(section.id); }}
                onDrop={() => handleDrop(section.id)}
                isDragOver={reordonnable && dragOverSectionId === section.id && dragSectionId !== section.id && !isNoOpTarget}
                isFirstSection={isFirstSheet && sectionIndex === 0}
                showExampleChords={isNewSheet && sectionIndex === 0}
                onDismissOnboarding={dismissOnboarding}
                onFrenchDetected={handleFrenchDetected}
                finderChordPool={finderChordPool}
                onMoveUp={reordonnable && sectionIndex > 0 ? () => moveSection(section.id, 'up') : undefined}
                onMoveDown={reordonnable && sectionIndex < sheet.sections.length - 1 ? () => moveSection(section.id, 'down') : undefined}
                anyDragging={anyDragging}
                isSelf={false}
              />
            </div>
          );
        })}

        {/* Zone de drop en fin de liste */}
        {dragSectionId && (
          <div
            className={`h-10 rounded-lg border-2 border-dashed transition-colors ${
              dragOverSectionId === '__end__'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)]'
            }`}
            onDragOver={(e) => { e.preventDefault(); handleDragOver('__end__'); }}
            onDrop={() => handleDrop('__end__')}
          />
        )}
      </div>

      {/* Bouton ajouter section — masqué pour Voix */}
      {sheet.instrumentId !== 'voice' && (
        <button
          onClick={addSection}
          className="w-full mt-2 py-4 border-2 border-dashed border-[var(--line)] rounded-xl
            text-[var(--ink-faint)] text-sm cursor-pointer transition-all bg-transparent
            hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]
            flex items-center justify-center gap-2"
        >
          {t('addSection')}
        </button>
      )}

      {/* Rappel des accords utilisés — masqué pour Voix */}
      {sheet.instrumentId !== 'voice' && (
        <div className="mt-8">
          <ChordSummary
            sections={sheet.sections}
            instrumentId={sheet.instrumentId || 'guitar'}
            customChords={sheet.customChords as CustomChordMap}
            editable
            onEditChord={handleEditChord}
            onDeleteCustomChord={handleDeleteCustomChord}
            onVariantChange={handleVariantSelect}
          />
        </div>
      )}

      {/* Paroles */}
      <LyricsEditor
        lyrics={sheet.lyrics || ''}
        artist={sheet.artist}
        title={sheet.title}
        onChange={(lyrics) => updateSheet({ lyrics })}
      />

      {/* Modal d'édition d'accord */}
      <ChordEditorModal
        isOpen={chordModalOpen}
        onClose={() => setChordModalOpen(false)}
        onSave={handleSaveCustomChord}
        chordName={editingChordName}
        instrumentId={sheet.instrumentId || 'guitar'}
        initialChord={editingChord}
      />

      {/* Barre de sauvegarde fixe */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--cell-bg)] border-t border-[var(--line)] py-4 px-6 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-[var(--ink-light)]">
            {validationError ? (
              <span className="text-red-600">⚠ {validationError}</span>
            ) : hasChanges ? (
              <span className="text-[var(--accent)]">● {t('unsavedChanges')}</span>
            ) : 'forkedFrom' in sheet && sheet.forkedFrom ? (
              <span className="text-[var(--ink-faint)]">⎘ {t('duplicatedFrom')}</span>
            ) : (
              <span>{t('allSaved')}</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => window.history.back()}>
              {t('cancel')}
            </Button>
            {('id' in sheet) && (
              <Link
                href={`/sheet/${sheet.id}`}
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm font-medium text-[var(--ink-light)] hover:text-[var(--ink)] hover:border-[var(--ink-faint)] transition-colors"
              >
                {t('view')}
              </Link>
            )}
            <Button onClick={handleSave} isLoading={isSaving} disabled={!hasChanges && 'id' in sheet}>
              {('id' in sheet) ? t('save') : t('createSheet')}
            </Button>
          </div>
        </div>
      </div>

      {dictation.listening && (
        <DictationBar
          pending={dictation.pending}
          audible={dictation.audible}
          error={dictation.error}
          canUndo={!!dictationTarget && (dictationTarget.rowIndex > 0 || dictationTarget.cellIndex > 0)}
          onUndo={undoDictation}
          onStop={toggleDictation}
        />
      )}
    </div>
  );
}
