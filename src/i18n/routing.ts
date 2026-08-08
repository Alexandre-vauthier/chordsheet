import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  /**
   * Pas d'annonces de langue en en-tête HTTP.
   *
   * next-intl en ajoutait un jeu dans un en-tête `Link:`, en plus de celui que les
   * pages posent dans leur `<head>`. Les deux ne disaient pas la même chose : le
   * `x-default` de l'en-tête pointait vers l'adresse **sans préfixe de langue**
   * — `/explore` plutôt que `/fr/explore` — c'est-à-dire vers une URL qui
   * redirige, et qui ne devrait donc jamais être annoncée comme alternative.
   *
   * Google accepte trois méthodes d'annonce (HTML, en-tête, sitemap) mais attend
   * qu'on en tienne une seule : deux valeurs contradictoires, et il peut ignorer
   * l'ensemble. On garde celle du `<head>`, qui vient d'`alternateLanguages()`
   * comme le sitemap — une seule source pour les deux.
   */
  alternateLinks: false,
});
