export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">

      <div className="mb-12">
        <h1 className="font-playfair text-4xl font-bold text-[var(--ink)] mb-3">Qui sommes-nous ?</h1>
        <p className="text-[var(--ink-light)] text-base leading-relaxed">
          Une histoire de famille, de cordes, et de mémoire.
        </p>
      </div>

      <div className="space-y-8 text-[var(--ink-light)] text-sm leading-[1.9]">

        <p>
          Notre père est guitariste. On a grandi avec des guitares qui traînaient dans les coins, des accords qui s&apos;échappaient d&apos;une pièce, une maison où la musique était une langue à part entière. Pour <strong className="text-[var(--ink)] font-semibold">Alexandre</strong>, c&apos;est à 13 ans que ça a vraiment mordu — cette sensation de poser les doigts sur un manche et de sentir que quelque chose se met en place. Son frère cadet <strong className="text-[var(--ink)] font-semibold">Julien</strong>, lui, a choisi la batterie. Deux ans et demi d&apos;écart, deux approches différentes, un seul terrain de jeu commun.
        </p>

        <p>
          À 15 ou 16 ans, on monte notre premier groupe. On ne sait pas grand-chose mais on joue des concerts, on se plante, on recommence. On passe des heures sur les forums, sur Guitar Pro, à déchiffrer des tablatures, à s&apos;échanger des trucs trouvés la nuit. La musique devient notre façon de nous retrouver — les anniversaires, Noël, les week-ends : autant d&apos;occasions de demander un nouvel instrument. Une basse. Un ukulélé. Un piano. Un banjo, une mandoline, une flûte de pan, un mélodica, des castagnettes. On essaie tout, du métal au classique, sans hiérarchie, sans frontière.
        </p>

        <p>
          Vingt ans ont passé. On a 35 ans aujourd&apos;hui, et on joue toujours ensemble — avec plus de maturité, plus d&apos;oreille, plus d&apos;expérience. Mais le combat reste étrangement le même : <em>c&apos;est quoi les accords déjà ? C&apos;est quelle structure ? On joue dans quel ordre ?</em> Et avec ça, une frustration tranquille : toutes ces chansons apprises il y a vingt ans, ces riffs, ces progressions, ces arrangements — évaporés. Perdus quelque part entre deux déménagements et une mise à jour de disque dur.
        </p>

        <p>
          ChordSheet est né de là. D&apos;un besoin simple et un peu douloureux : <strong className="text-[var(--ink)] font-semibold">ne pas perdre ce qu&apos;on a appris</strong>. Se souvenir. Avoir un endroit où poser une grille proprement, retrouver un accord à 2h du matin avant une répèt, partager la structure d&apos;un morceau sans envoyer une photo floue d&apos;un carnet à spirales.
        </p>

        <p>
          On l&apos;a construit à deux. Alexandre sur la technique, Julien — alias <strong className="text-[var(--ink)] font-semibold">Piza</strong> — sur la vision musicale, le solfège, la rigueur de quelqu&apos;un qui lit vraiment une partition. Ce que l&apos;un ne sait pas faire, l&apos;autre le porte. C&apos;est un peu notre fonctionnement depuis le début.
        </p>

        <p>
          En construisant l&apos;outil, on a réalisé qu&apos;il ne s&apos;adressait pas qu&apos;à nous. Un groupe qui répète a besoin d&apos;une lecture commune — pas cinq versions différentes du même morceau notées sur cinq téléphones. Un prof de guitare a besoin de partager ses grilles à ses élèves sans que ça ressemble à un puzzle. Un musicien seul a besoin de son book, de son répertoire, quelque chose de personnel et de durable.
        </p>

        <p>
          ChordSheet est multi-instruments parce qu&apos;on l&apos;est. Il est conçu pour jouer ensemble parce que c&apos;est la seule raison pour laquelle on a commencé. Et il regarde vers l&apos;avenir — l&apos;IA pour retranscrire une partition, l&apos;organisation d&apos;un concert, le partage au sein d&apos;un groupe — parce qu&apos;on a les moyens techniques aujourd&apos;hui de régler des problèmes qu&apos;on traînait depuis l&apos;adolescence.
        </p>

        <p className="text-[var(--ink)] font-medium">
          C&apos;est un outil fait par des musiciens, pour des musiciens. Pas plus, pas moins.
        </p>

      </div>

      {/* Signatures */}
      <div className="mt-14 pt-8 border-t border-[var(--line)] flex gap-10">
        <div>
          <div className="font-playfair text-lg font-bold text-[var(--ink)]">Alexandre</div>
          <div className="text-xs text-[var(--ink-faint)] mt-0.5">Développement &amp; design</div>
        </div>
        <div>
          <div className="font-playfair text-lg font-bold text-[var(--ink)]">Julien <span className="text-[var(--ink-faint)] font-normal text-sm">(Piza)</span></div>
          <div className="text-xs text-[var(--ink-faint)] mt-0.5">Vision musicale &amp; solfège</div>
        </div>
      </div>

    </div>
  );
}
