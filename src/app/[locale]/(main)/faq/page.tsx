const SECTIONS: { title: string; items: { question: string; answer: string }[] }[] = [
  {
    title: "Démarrer",
    items: [
      {
        question: "C'est quoi ChordSheet ?",
        answer:
          "ChordSheet est une application web pour créer, organiser et partager des grilles d'accords. Tu peux saisir tes grilles à la main, les importer depuis un texte d'accords, ou les extraire automatiquement depuis une photo de partition. Les grilles sont accessibles depuis n'importe quel appareil, et tu peux les imprimer ou les consulter en concert sans rien installer.",
      },
      {
        question: "Comment créer une grille ?",
        answer:
          "Depuis le dashboard ou le bouton \"+ Grille\" en haut à droite, tu as trois options : partir d'une grille vierge et saisir les accords à la main, coller un texte au format accord+paroles, ou déposer une photo de partition pour une transcription automatique par IA.",
      },
    ],
  },
  {
    title: "Importer & analyser",
    items: [
      {
        question: "Comment importer une grille depuis un texte ?",
        answer:
          "Copie le texte d'une grille au format accord+paroles (accords écrits au-dessus des paroles, sections nommées comme [Verse] ou [Chorus]), puis dans ChordSheet clique sur \"+ Grille\" → \"Importer du texte\" et colle-le. L'application détecte automatiquement le titre, l'artiste, la tonalité, le tempo et la structure en sections.",
      },
      {
        question: "Comment fonctionne l'analyse de partition ?",
        answer:
          "Tu déposes une ou plusieurs photos de ta partition (JPG, PNG, WebP). Un modèle d'IA analyse les images, identifie les accords mesure par mesure, la structure du morceau (intro, couplet, refrain…), les répétitions et la signature rythmique, puis génère automatiquement une grille. Tu peux ensuite la corriger dans l'éditeur.",
      },
      {
        question: "Les accords détectés sont faux, que faire ?",
        answer:
          "L'import texte et l'analyse de partition sont des interprétations automatiques — l'IA fait de son mieux mais peut se tromper, notamment sur les durées, les accords complexes ou les passages ambigus. C'est tout à fait normal. Dans l'éditeur, tu peux corriger ou surcharger n'importe quel accord comme tu le souhaites : modifier le nom, étendre ou diviser la durée, ajouter ou supprimer des cellules. La grille t'appartient.",
      },
    ],
  },
  {
    title: "Éditer & personnaliser",
    items: [
      {
        question: "Puis-je créer des accords personnalisés ?",
        answer:
          "Oui. Dans l'éditeur, tu peux définir tes propres doigtés pour des accords non présents dans la bibliothèque, ou modifier un doigté existant. Ces accords personnalisés sont enregistrés avec la grille et visibles dans les diagrammes.",
      },
      {
        question: "Quels instruments sont supportés ?",
        answer:
          "ChordSheet gère sept instruments : Guitare, Ukulélé, Mandoline, Banjo, Basse, Piano et Voix. Chaque instrument dispose de sa propre bibliothèque d'accords et de ses diagrammes (manche ou clavier selon l'instrument).",
      },
      {
        question: "La notation française (Do Ré Mi) est-elle supportée ?",
        answer:
          "Oui. Dans ton profil, tu peux choisir entre la notation américaine (C D E F G A B) et la notation française (Do Ré Mi Fa Sol La Si). L'affichage bascule sur toute l'application, les accords restant stockés en notation américaine.",
      },
    ],
  },
  {
    title: "Partage & collaboration",
    items: [
      {
        question: "Mes grilles sont-elles visibles par tout le monde ?",
        answer:
          "Non, toutes les grilles sont privées par défaut. Tu peux les rendre publiques depuis l'éditeur (elles apparaissent alors dans la page Explorer), ou les partager via un lien unique sans les rendre publiques (mode \"non répertorié\").",
      },
      {
        question: "C'est quoi un Groupe ?",
        answer:
          "Un Groupe permet de partager des grilles avec d'autres musiciens. Le créateur invite les membres via un lien, et les grilles liées au groupe sont accessibles à tous les membres, même si elles sont privées. Pratique pour une formation ou une classe.",
      },
      {
        question: "C'est quoi un Set ?",
        answer:
          "Un Set est une setlist : une liste ordonnée de grilles pour un concert ou une répétition. En mode concert (\"Jouer\"), les grilles défilent en plein écran, les accords sont agrandis et tu passes d'un morceau à l'autre d'un glissement ou d'un clic.",
      },
      {
        question: "Quelle est la différence entre un Set et un Groupe ?",
        answer:
          "Un Set est un outil personnel de planification : tu y mets les morceaux dans l'ordre pour un concert ou une répétition, et tu les joues en mode plein écran. Un Groupe est un espace de partage : il regroupe des musiciens et leur donne accès aux mêmes grilles. Les deux sont complémentaires — tu peux créer un Set à partir des grilles partagées dans ton Groupe.",
      },
    ],
  },
  {
    title: "Consulter & imprimer",
    items: [
      {
        question: "Comment transposer une grille ?",
        answer:
          "En mode consultation, un sélecteur de transposition est disponible en bas de l'écran. Tu peux décaler de −6 à +6 demi-tons en temps réel. La transposition n'est qu'un affichage : la grille originale est conservée telle quelle.",
      },
      {
        question: "Peut-on imprimer une grille ?",
        answer:
          "Oui. Un bouton d'impression est disponible en vue consultation. La mise en page s'adapte automatiquement pour un rendu propre sur papier : la navbar et les contrôles disparaissent, les diagrammes d'accords peuvent être inclus en option.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="font-playfair text-3xl font-bold text-[var(--ink)] mb-2">Questions fréquentes</h1>
        <p className="text-[var(--ink-light)] text-sm">Tout ce qu&apos;il faut savoir pour bien démarrer sur ChordSheet.</p>
      </div>

      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-playfair text-lg font-bold text-[var(--ink)] mb-3 pb-2 border-b border-[var(--line)]">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item, i) => (
                <FaqItem key={i} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-[var(--line)] text-center">
        <p className="text-sm text-[var(--ink-light)]">
          Une question qui n&apos;est pas là ?{' '}
          <a href="mailto:alex.vauthier@gmail.com" className="text-[var(--accent)] hover:underline">
            Contacte-nous
          </a>
        </p>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border border-[var(--line)] rounded-xl bg-[var(--cell-bg)] overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none
        hover:bg-[var(--accent-soft)] transition-colors">
        <span className="font-medium text-[var(--ink)] pr-4">{question}</span>
        <span className="flex-shrink-0 text-[var(--ink-faint)] transition-transform duration-200 group-open:rotate-45 text-xl leading-none">
          +
        </span>
      </summary>
      <div className="px-5 pb-4 pt-1 text-sm text-[var(--ink-light)] leading-relaxed border-t border-[var(--line)]">
        {answer}
      </div>
    </details>
  );
}
