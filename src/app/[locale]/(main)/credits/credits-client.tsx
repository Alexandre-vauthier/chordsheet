'use client';

import { useTranslations } from 'next-intl';

export function CreditsClient() {
  const t = useTranslations('Credits');
  const strong = (chunks: React.ReactNode) => <strong className="text-[var(--ink)]">{chunks}</strong>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">

      <div className="mb-12">
        <h1 className="font-playfair text-4xl font-bold text-[var(--ink)] mb-3">{t('pageTitle')}</h1>
        <p className="text-[var(--ink-light)] text-base leading-relaxed">
          {t('intro')}
        </p>
      </div>

      <div className="space-y-12 text-sm text-[var(--ink-light)] leading-[1.9]">

        {/* La famille */}
        <section>
          <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">{t('familyTitle')}</h2>
          <p>
            {t.rich('familyBody', { strong })}
          </p>
        </section>

        {/* Le groupe */}
        <section>
          <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">{t('bandTitle')}</h2>
          <p>
            {t('bandBody')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {['Nico', 'Gus', 'Ced', 'Flo', 'Jo'].map((name) => (
              <span
                key={name}
                className="px-4 py-1.5 rounded-full border border-[var(--line)] bg-[var(--cell-bg)] text-[var(--ink)] text-sm font-medium"
              >
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* Les complices */}
        <section>
          <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">{t('friendsTitle')}</h2>

          <div className="space-y-6">
            <div>
              <div className="font-semibold text-[var(--ink)]">
                Greg <span className="text-[var(--ink-faint)] font-normal text-xs ml-1">{t('gregAlias')}</span>
              </div>
              <p className="mt-1">
                {t('gregBody')}
              </p>
            </div>

            <div>
              <div className="font-semibold text-[var(--ink)]">
                Bastien <span className="text-[var(--ink-faint)] font-normal text-xs ml-1">{t('bastienAlias')}</span>
              </div>
              <p className="mt-1">
                {t('bastienBody')}
              </p>
            </div>
          </div>
        </section>

        {/* Les sources extérieures. Sans elles l'application marcherait, mais elle
            n'aurait pas ce rendu : pas de pochette, pas d'extrait, un piano en
            oscillateur et un tempo à saisir à la main. */}
        <section className="pt-6 border-t border-[var(--line)]">
          <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-2">{t('sourcesTitle')}</h2>
          <p className="text-[var(--ink-light)] text-sm leading-relaxed mb-4">{t('sourcesIntro')}</p>

          <ul className="space-y-3 text-sm text-[var(--ink-light)]">
            {[
              { name: 'Apple Music', url: 'https://music.apple.com', body: t('sourceApple') },
              { name: 'Deezer', url: 'https://www.deezer.com', body: t('sourceDeezer') },
              { name: 'GetSongBPM', url: 'https://getsongbpm.com', body: t('sourceBpm') },
              { name: 'smplr', url: 'https://github.com/danigb/smplr', body: t('sourceSmplr') },
              { name: 'LinnDrum LM-2', url: null, body: t('sourceLinn') },
            ].map(({ name, url, body }) => (
              <li key={name}>
                <span className="font-semibold text-[var(--ink)]">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">
                      {name}
                    </a>
                  ) : name}
                </span>
                {' — '}
                {body}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-[var(--ink-faint)] text-xs pt-4 border-t border-[var(--line)]">
          {t('closing')}
        </p>

      </div>
    </div>
  );
}
