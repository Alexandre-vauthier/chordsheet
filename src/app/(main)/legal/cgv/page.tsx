export default function CgvPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-2">Conditions Générales de Vente</h1>
      <p className="text-sm text-[var(--ink-faint)] mb-8">En cours de rédaction</p>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--cell-bg)] p-8 text-center">
        <p className="text-[var(--ink)] font-medium mb-2">Une offre premium arrive bientôt</p>
        <p className="text-sm text-[var(--ink-light)]">
          ChordSheet proposera prochainement des fonctionnalités avancées sous forme d&apos;abonnement. Les conditions générales de vente seront publiées à cette occasion.
        </p>
        <p className="text-sm text-[var(--ink-light)] mt-4">
          Pour toute question : <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>
        </p>
      </div>

      <p className="text-xs text-[var(--ink-faint)] mt-10">Dernière mise à jour : avril 2025</p>
    </div>
  );
}
