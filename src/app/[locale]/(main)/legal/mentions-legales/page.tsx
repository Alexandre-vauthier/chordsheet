export default function MentionsLegalesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--ink)] mb-8">Mentions légales</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">Éditeur du site</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          ChordSheet est édité par :<br />
          <strong className="text-[var(--ink)]">Alexandre Vauthier</strong><br />
          Auto-entrepreneur<br />
          195 rue Beauvoisine<br />
          76000 Rouen, France<br />
          Email : <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">alex.vauthier@gmail.com</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">Directeur de la publication</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Alexandre Vauthier
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">Hébergement</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Le site est hébergé par :<br />
          <strong className="text-[var(--ink)]">Google Ireland Limited</strong><br />
          Gordon House, Barrow Street<br />
          Dublin 4, Irlande<br />
          via les services <strong className="text-[var(--ink)]">Firebase / Google Cloud Platform</strong>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">Propriété intellectuelle</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          L&apos;ensemble des éléments constituant ce site (design, logo, textes, code) est la propriété exclusive d&apos;Alexandre Vauthier, sauf mentions contraires. Toute reproduction, représentation ou diffusion, en tout ou partie, sur quelque support que ce soit, sans autorisation expresse, est interdite et constituerait une contrefaçon sanctionnée par le Code de la propriété intellectuelle.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">Responsabilité</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Alexandre Vauthier s&apos;efforce d&apos;assurer l&apos;exactitude des informations présentes sur le site, mais ne peut garantir leur exhaustivité ni leur actualité. L&apos;éditeur se réserve le droit de corriger ou modifier le contenu à tout moment sans préavis.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3">Droit applicable</h2>
        <p className="text-sm text-[var(--ink-light)] leading-relaxed">
          Le présent site est soumis au droit français. Tout litige relatif à son utilisation sera soumis aux tribunaux compétents de Rouen.
        </p>
      </section>

      <p className="text-xs text-[var(--ink-faint)] mt-10">Dernière mise à jour : avril 2025</p>
    </div>
  );
}
