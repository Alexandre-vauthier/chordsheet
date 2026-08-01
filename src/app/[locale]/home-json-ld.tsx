import { useLocale } from 'next-intl';
import { JsonLd } from '@/components/seo/json-ld';
import { webSiteSchema, organizationSchema } from '@/lib/seo-schema';

/**
 * Données structurées de l'accueil. La page étant un composant client, ce bloc est
 * isolé ici pour rester rendu au plus près du serveur ; `useLocale` fonctionne des
 * deux côtés et évite de faire descendre la locale en prop.
 */
export function HomeJsonLd() {
  const locale = useLocale();
  return <JsonLd data={[webSiteSchema(locale), organizationSchema(locale)]} />;
}
