export default function ConfidentialitePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-2">Politique de confidentialité</h1>
      <p className="text-sm text-[var(--ink-faint)] mb-8">En vigueur au 21 avril 2025 — conforme au RGPD</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">1. Responsable du traitement</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Le responsable du traitement des données personnelles est :<br />
          <strong className="text-[var(--ink)]">Alexandre Vauthier</strong> — Auto-entrepreneur<br />
          195 rue Beauvoisine, 76000 Rouen<br />
          Email : <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">2. Données collectées</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
          Lors de l&apos;utilisation de ChordSheet, les données suivantes sont collectées :
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left py-2 pr-4 font-medium text-[var(--ink)]">Donnée</th>
                <th className="text-left py-2 pr-4 font-medium text-[var(--ink)]">Finalité</th>
                <th className="text-left py-2 font-medium text-[var(--ink)]">Base légale</th>
              </tr>
            </thead>
            <tbody className="text-[var(--ink-light)]">
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">Adresse email</td>
                <td className="py-2 pr-4">Authentification, contact</td>
                <td className="py-2">Exécution du contrat</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">Nom d&apos;affichage</td>
                <td className="py-2 pr-4">Identification publique</td>
                <td className="py-2">Exécution du contrat</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">Date de création de compte</td>
                <td className="py-2 pr-4">Gestion du compte</td>
                <td className="py-2">Exécution du contrat</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">Date de dernière connexion</td>
                <td className="py-2 pr-4">Sécurité, inactivité</td>
                <td className="py-2">Intérêt légitime</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-4">Grilles d&apos;accords créées</td>
                <td className="py-2 pr-4">Fonctionnement du service</td>
                <td className="py-2">Exécution du contrat</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Favoris (bookmarks)</td>
                <td className="py-2 pr-4">Personnalisation</td>
                <td className="py-2">Exécution du contrat</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">3. Hébergement et transfert des données</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Les données sont hébergées sur les serveurs de <strong className="text-[var(--ink)]">Google Firebase</strong> (Google Ireland Limited, Dublin, Irlande). Google est susceptible de transférer des données vers des serveurs situés hors de l&apos;Union Européenne, dans le cadre de clauses contractuelles types approuvées par la Commission Européenne.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">4. Durée de conservation</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Les données sont conservées pendant toute la durée d&apos;activité du compte, puis supprimées dans un délai de 30 jours suivant la demande de clôture. Les grilles publiées en mode public pourront être conservées sous forme anonymisée à des fins statistiques.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">5. Cookies</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          ChordSheet utilise des cookies techniques strictement nécessaires au fonctionnement de l&apos;authentification (Firebase Authentication). Aucun cookie publicitaire ou de tracking tiers n&apos;est déposé.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">6. Vos droits</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed mb-3">
          Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
        </p>
        <ul className="text-sm text-[var(--ink-light)] leading-relaxed list-disc list-inside space-y-1 mb-3">
          <li><strong className="text-[var(--ink)]">Accès</strong> : obtenir une copie de vos données ;</li>
          <li><strong className="text-[var(--ink)]">Rectification</strong> : corriger des données inexactes ;</li>
          <li><strong className="text-[var(--ink)]">Effacement</strong> : demander la suppression de vos données ;</li>
          <li><strong className="text-[var(--ink)]">Portabilité</strong> : recevoir vos données dans un format structuré ;</li>
          <li><strong className="text-[var(--ink)]">Opposition</strong> : vous opposer à un traitement fondé sur l&apos;intérêt légitime.</li>
        </ul>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Pour exercer ces droits, contactez-nous à <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>. En cas de réclamation non résolue, vous pouvez saisir la <strong className="text-[var(--ink)]">CNIL</strong> (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">www.cnil.fr</a>).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">7. Modification de la politique</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Cette politique peut être mise à jour. Toute modification substantielle sera notifiée par email aux utilisateurs concernés.
        </p>
      </section>

      <p className="text-xs text-[var(--ink-faint)] mt-10">Dernière mise à jour : avril 2025</p>
    </div>
  );
}
