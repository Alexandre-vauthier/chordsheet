export default function CreditsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">

      <div className="mb-12">
        <h1 className="font-playfair text-4xl font-bold text-[var(--ink)] mb-3">Crédits</h1>
        <p className="text-[var(--ink-light)] text-base leading-relaxed">
          Un outil ne naît pas seul. Voici ceux qui, de près ou de loin, en sont un peu les auteurs.
        </p>
      </div>

      <div className="space-y-12 text-sm text-[var(--ink-light)] leading-[1.9]">

        {/* La famille */}
        <section>
          <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">La famille</h2>
          <p>
            Tout commence là. <strong className="text-[var(--ink)]">Julien</strong> — mon frère, Piza — dont la vision musicale et le solfège sont dans chaque mesure de cet outil. <strong className="text-[var(--ink)]">Mon père</strong>, qui a posé des guitares dans nos mains avant qu&apos;on sache s&apos;en servir. <strong className="text-[var(--ink)]">Ma mère</strong>, qui depuis s&apos;est mise à la guitare et à la basse — parce que la musique, une fois qu&apos;elle entre dans une maison, elle ne repart plus.
          </p>
        </section>

        {/* Le groupe */}
        <section>
          <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">Le groupe</h2>
          <p>
            Ceux avec qui tout a vraiment commencé — les premières répétitions dans des garages, les premiers concerts, les premiers riffs appris ensemble et aussitôt oubliés. C&apos;est un peu pour eux, et à cause d&apos;eux, que ChordSheet existe.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {['Nico', 'Gus', 'Ced', 'Flo', 'Jo', 'Yokss'].map((name) => (
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
          <h2 className="font-playfair text-xl font-bold text-[var(--ink)] mb-4">Les complices</h2>

          <div className="space-y-6">
            <div>
              <div className="font-semibold text-[var(--ink)]">
                Greg <span className="text-[var(--ink-faint)] font-normal text-xs ml-1">alias Keiturna</span>
              </div>
              <p className="mt-1">
                Grand guitariste et homme de vision. Greg a été l&apos;un des premiers à comprendre ce que cet outil pouvait devenir, à en dessiner les contours avec moi, et à poser les bonnes questions au bon moment. Ce genre de regard extérieur qui change tout.
              </p>
            </div>

            <div>
              <div className="font-semibold text-[var(--ink)]">Bastien</div>
              <p className="mt-1">
                Guitariste et développeur — la combinaison rêvée pour ce projet. Bastien comprend les deux côtés de la chose : ce qu&apos;un musicien attend d&apos;un outil, et comment le construire proprement. Son aide compte beaucoup.
              </p>
            </div>
          </div>
        </section>

        <p className="text-[var(--ink-faint)] text-xs pt-4 border-t border-[var(--line)]">
          Et à tous ceux qui utilisent ChordSheet, partagent leurs grilles, font remonter leurs retours — merci. Vous êtes la meilleure raison de continuer.
        </p>

      </div>
    </div>
  );
}
