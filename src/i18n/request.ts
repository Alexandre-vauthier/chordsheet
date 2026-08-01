import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // Les textes éditoriaux (référencement) vivent dans un fichier séparé : ils
  // sont volumineux, rendus uniquement côté serveur, et n'ont donc rien à faire
  // dans la charge envoyée au navigateur — voir le filtrage dans [locale]/layout.tsx.
  const [ui, editorial] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/editorial/${locale}.json`),
  ]);

  return {
    locale,
    messages: { ...ui.default, ...editorial.default },
  };
});
