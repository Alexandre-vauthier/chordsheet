export default function CguPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-2">Conditions Générales d&apos;Utilisation</h1>
      <p className="text-sm text-[var(--ink-faint)] mb-8">En vigueur au 21 avril 2025</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">1. Objet</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation de la plateforme ChordSheet, accessible à l&apos;adresse chordsheet.app, éditée par Alexandre Vauthier (auto-entrepreneur, 195 rue Beauvoisine, 76000 Rouen). En créant un compte, l&apos;utilisateur accepte sans réserve les présentes CGU.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">2. Accès au service</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          ChordSheet est accessible à toute personne physique disposant d&apos;un compte Google. L&apos;inscription est gratuite. Une offre premium payante pourra être proposée ultérieurement ; ses conditions seront précisées dans les Conditions Générales de Vente applicables.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">3. Compte utilisateur</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          L&apos;utilisateur est responsable de la confidentialité de son compte et de toute activité réalisée depuis celui-ci. Il s&apos;engage à ne pas créer de compte avec de fausses informations et à notifier immédiatement l&apos;éditeur de tout accès non autorisé à son compte.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">4. Contenu utilisateur et cession de droits</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
          L&apos;utilisateur reste propriétaire des grilles d&apos;accords qu&apos;il crée. En publiant une grille en mode <strong className="text-[var(--ink)]">public</strong>, l&apos;utilisateur concède à Alexandre Vauthier une licence mondiale, non exclusive, gratuite, sous-licenciable et transférable pour utiliser, reproduire, diffuser, afficher et adapter ce contenu dans le cadre du fonctionnement et de la promotion de ChordSheet.
        </p>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Cette licence prend fin lorsque l&apos;utilisateur supprime le contenu ou repasse la grille en mode privé, sous réserve des délais techniques de traitement. Les grilles privées ne sont accessibles qu&apos;à leur auteur.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">5. Comportements interdits</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-2">Il est notamment interdit de :</p>
        <ul className="text-sm text-[var(--ink-light)] leading-relaxed list-disc list-inside space-y-1">
          <li>publier du contenu illicite, diffamatoire, offensant ou contrefaisant ;</li>
          <li>reproduire intégralement des paroles de chansons protégées par le droit d&apos;auteur sans autorisation ;</li>
          <li>tenter de contourner les mesures de sécurité du service ;</li>
          <li>utiliser le service à des fins commerciales non autorisées.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">6. Propriété intellectuelle</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          ChordSheet, son interface, son code et ses contenus propres sont protégés par le droit de la propriété intellectuelle. Toute reproduction sans autorisation écrite est interdite.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">7. Responsabilité</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          L&apos;éditeur ne peut être tenu responsable des contenus publiés par les utilisateurs ni des dommages indirects résultant de l&apos;utilisation du service. Le service est fourni « en l&apos;état » et peut être interrompu à tout moment pour maintenance ou raisons techniques.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">8. Modification et résiliation</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout moment. L&apos;utilisateur en sera informé par email ou notification sur le service. La poursuite de l&apos;utilisation du service après modification vaut acceptation des nouvelles CGU. L&apos;éditeur peut suspendre ou supprimer un compte en cas de non-respect des présentes conditions.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">9. Droit applicable</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Les présentes CGU sont soumises au droit français. Tout litige sera soumis aux tribunaux compétents de Rouen.
        </p>
      </section>

      <p className="text-xs text-[var(--ink-faint)] mt-10">Dernière mise à jour : avril 2025</p>
    </div>
  );
}
