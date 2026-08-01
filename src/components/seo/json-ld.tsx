/**
 * Rendu d'un bloc de données structurées.
 *
 * Composant serveur : le balisage part dans le HTML initial, ce qui est la seule
 * forme que les moteurs lisent de façon fiable.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify échappe déjà ce qu'il faut ; on neutralise en plus la
      // séquence `</script>` qu'une donnée utilisateur pourrait contenir.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
