'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDb } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { fromFirestore } from '@/lib/firestore-helpers';
import { isPro } from '@/lib/plan-limits';
import { SettingsNav } from '@/components/profile/settings-nav';
import { SettingsPanel } from '@/components/profile/settings-panel';
import { SECTION_DEFAUT, isSectionId, type SectionId } from '@/components/profile/sections';
import { AccountSection } from '@/components/profile/account-section';
import { PublicSection } from '@/components/profile/public-section';
import { InstrumentSection } from '@/components/profile/instrument-section';
import { DisplaySection } from '@/components/profile/display-section';
import { PlaybackSection } from '@/components/profile/playback-section';
import { PrintSection } from '@/components/profile/print-section';
import { SubscriptionSection } from '@/components/profile/subscription-section';
import type { UserStats } from '@/components/profile/stats-cards';
import type { Sheet } from '@/types';

/**
 * La page de réglages : un rail de rubriques, un panneau de détail.
 *
 * Elle empilait vingt-six blocs sur un seul défilement, dont onze cartes
 * identiques pour une phrase et un interrupteur chacune. Le remède n'est pas de
 * découper en sept pages moyennement longues : c'est d'aplatir les cartes en
 * lignes et de ne montrer qu'une rubrique à la fois.
 *
 * **Sur petit écran**, l'absence de `?r` est un état à part entière : on n'affiche
 * que la liste. C'est ce qui donne un écran d'arrivée qui tient en entier, et un
 * bouton « retour » du navigateur qui fait ce qu'on attend.
 */
function Reglages() {
  const t = useTranslations('Profile');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const parametre = searchParams.get('r');
  const active: SectionId = isSectionId(parametre) ? parametre : SECTION_DEFAUT;
  const listeSeule = parametre === null;

  const aller = (id: SectionId) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('r', id);
    // Depuis la liste, on empile : le retour doit y ramener. D'une rubrique à
    // l'autre, on remplace, sinon quitter la page après cinq rubriques
    // demanderait cinq retours.
    const naviguer = parametre ? router.replace : router.push;
    naviguer(`/profile?${p.toString()}`, { scroll: false });
  };

  const revenir = () => router.push('/profile', { scroll: false });

  /**
   * Une seule lecture pour les compteurs et la réputation.
   *
   * Les grilles publiques servent au calcul de réputation, les totaux aux quatre
   * compteurs : les demander deux fois doublerait la facture pour rien.
   */
  const [stats, setStats] = useState<UserStats | null>(null);
  const [publicSheets, setPublicSheets] = useState<Sheet[]>([]);

  useEffect(() => {
    if (!user) return;
    let vivant = true;

    (async () => {
      const db = getDb();
      const [grilles, sets, favoris] = await Promise.all([
        getDocs(query(collection(db, 'sheets'), where('ownerId', '==', user.id))),
        getDocs(query(collection(db, 'sets'), where('ownerId', '==', user.id))),
        getDocs(query(collection(db, 'bookmarks'), where('userId', '==', user.id))),
      ]);
      if (!vivant) return;

      const publiques = grilles.docs.filter((d) => d.data().isPublic);
      setPublicSheets(publiques.map((d) => fromFirestore(d.id, d.data())));
      setStats({
        sheetsCount: grilles.size,
        publicSheetsCount: publiques.length,
        setsCount: sets.size,
        bookmarksCount: favoris.size,
      });
    })().catch(() => { /* la page reste utilisable sans ses compteurs */ });

    return () => { vivant = false; };
  }, [user]);

  if (loading) return <Squelette />;
  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-[var(--ink-light)]">{t('notLoggedIn')}</p>
      </div>
    );
  }

  const libelles: Record<SectionId, string> = {
    compte: t('navAccount'),
    public: t('navPublic'),
    instrument: t('navInstrument'),
    affichage: t('navDisplay'),
    lecture: t('navPlayback'),
    impression: t('navPrint'),
    abonnement: t('navSubscription'),
  };
  const intros: Record<SectionId, string> = {
    compte: t('introAccount'),
    public: t('introPublic'),
    instrument: t('introInstrument'),
    affichage: t('introDisplay'),
    lecture: t('introPlayback'),
    impression: t('introPrint'),
    abonnement: t('introSubscription'),
  };

  const contenu: Record<SectionId, React.ReactNode> = {
    compte: <AccountSection stats={stats} />,
    public: <PublicSection publicSheets={publicSheets} />,
    instrument: <InstrumentSection />,
    affichage: <DisplaySection />,
    lecture: <PlaybackSection />,
    impression: <PrintSection />,
    abonnement: <SubscriptionSection succes={searchParams.get('upgrade') === 'success'} />,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-playfair text-2xl font-bold text-[var(--ink)] mb-6">{t('title')}</h1>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav
          aria-label={t('title')}
          className={`w-full md:w-64 shrink-0 md:sticky md:top-[4.5rem] ${listeSeule ? 'block' : 'hidden md:block'}`}
        >
          <SettingsNav
            active={active}
            labels={libelles}
            onSelect={aller}
            badges={{
              abonnement: (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isPro(user.subscription) ? 'bg-[var(--accent)] text-white' : 'bg-[var(--line)] text-[var(--ink-light)]'
                }`}>
                  {isPro(user.subscription) ? t('pro') : t('free')}
                </span>
              ),
            }}
          />
        </nav>

        <section className={`flex-1 min-w-0 ${listeSeule ? 'hidden md:block' : 'block'}`}>
          <SettingsPanel
            title={libelles[active]}
            intro={intros[active]}
            backLabel={t('backToSettings')}
            onBack={revenir}
          >
            {contenu[active]}
          </SettingsPanel>
        </section>
      </div>
    </div>
  );
}

function Squelette() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="animate-pulse flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-[var(--cell-bg)]" />
          ))}
        </div>
        <div className="flex-1 h-64 rounded-2xl bg-[var(--cell-bg)]" />
      </div>
    </div>
  );
}

/**
 * `useSearchParams` impose une frontière de suspense au prérendu. La page étant
 * privée et non indexable, un repli dans le HTML statique ne coûte rien.
 */
export function ProfileClient() {
  return (
    <Suspense fallback={<Squelette />}>
      <Reglages />
    </Suspense>
  );
}
