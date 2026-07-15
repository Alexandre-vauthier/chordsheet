export default function CgvPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10 text-sm text-[var(--ink-light)] leading-relaxed">

      <div>
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] mb-2">
          Conditions Générales de Vente
        </h1>
        <p className="text-xs text-[var(--ink-faint)]">Dernière mise à jour : juin 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">1. Vendeur</h2>
        <p>
          ChordSheet est édité par Alexandre Vauthier, auto-entrepreneur, domicilié au 195 rue Beauvoisine, 76000 Rouen, France.
          Contact : <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">2. Objet</h2>
        <p>
          Les présentes Conditions Générales de Vente (CGV) régissent l&apos;achat de l&apos;abonnement <strong className="text-[var(--ink)]">ChordSheet Pro</strong>, qui donne accès à des fonctionnalités avancées de l&apos;application web ChordSheet (chordsheet.app).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">3. Offre et tarifs</h2>
        <p>L&apos;abonnement ChordSheet Pro est proposé aux tarifs suivants :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-[var(--ink)]">Mensuel</strong> : 4,90 € TTC / mois</li>
          <li><strong className="text-[var(--ink)]">Annuel</strong> : 39,00 € TTC / an (soit 3,25 € / mois)</li>
        </ul>
        <p>
          Les prix sont exprimés en euros toutes taxes comprises. Alexandre Vauthier est auto-entrepreneur non assujetti à la TVA (article 293 B du CGI) — les prix affichés sont donc les prix finaux.
        </p>
        <p>Les tarifs peuvent être modifiés à tout moment. Les abonnements en cours ne sont pas affectés par une hausse de tarif avant leur renouvellement.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">4. Fonctionnalités Pro</h2>
        <p>L&apos;abonnement Pro inclut :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Création et gestion de groupes de musiciens (illimité)</li>
          <li>Mode concert synchronisé en temps réel</li>
          <li>Export PDF multi-grilles d&apos;un Set (setlist) entier en un seul document</li>
          <li>Analyses OCR de partitions illimitées (usage raisonnable : 100 analyses/mois)</li>
          <li>Badge Pro sur le profil public</li>
        </ul>
        <p>
          Les fonctionnalités du plan gratuit (grilles illimitées, export PDF, accords personnalisés, 2 analyses OCR/mois) restent accessibles sans abonnement.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">5. Commande et paiement</h2>
        <p>
          L&apos;abonnement est souscrit en ligne via la page de tarifs de ChordSheet. Le paiement est traité par <strong className="text-[var(--ink)]">Stripe</strong> (Stripe Payments Europe, Ltd), prestataire de paiement sécurisé. Les coordonnées bancaires ne sont pas conservées par ChordSheet.
        </p>
        <p>
          L&apos;abonnement est renouvelé automatiquement à chaque échéance (mensuelle ou annuelle) jusqu&apos;à résiliation. Un reçu est émis par Stripe à chaque renouvellement.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">6. Droit de rétractation</h2>
        <p>
          Conformément à l&apos;article L.221-28 du Code de la consommation, le droit de rétractation de 14 jours ne s&apos;applique pas aux contenus numériques dont l&apos;exécution a commencé avec votre accord exprès avant l&apos;expiration du délai de rétractation.
        </p>
        <p>
          Toutefois, si vous n&apos;avez pas utilisé les fonctionnalités Pro depuis votre souscription, vous pouvez demander un remboursement dans les 14 jours suivant l&apos;achat en contactant <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">7. Résiliation</h2>
        <p>
          Vous pouvez résilier votre abonnement à tout moment depuis votre profil (section « Mon abonnement »). La résiliation prend effet à la fin de la période en cours — aucun remboursement prorata temporis n&apos;est effectué. Vos données et grilles restent accessibles après résiliation.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">8. Disponibilité du service</h2>
        <p>
          ChordSheet est fourni « en l&apos;état ». Bien que nous fassions de notre mieux pour assurer la continuité du service, nous ne garantissons pas une disponibilité ininterrompue. En cas d&apos;interruption prolongée imputable à ChordSheet, un remboursement prorata peut être accordé sur demande.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base text-[var(--ink)]">9. Litiges</h2>
        <p>
          Les présentes CGV sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents de Rouen seront saisis.
        </p>
        <p>
          Conformément à l&apos;article L.616-1 du Code de la consommation, vous pouvez recourir gratuitement au service de médiation de la consommation. Le médiateur compétent est la plateforme européenne de règlement en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" className="text-[var(--accent)] hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.
        </p>
      </section>

    </div>
  );
}
