import type { Metadata } from "next";
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { SITE_URL, SITE_NAME, buildAlternates, buildOpenGraph } from '@/lib/seo';
import { DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import { routing } from "@/i18n/routing";
import "../globals.css";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500"],
});

const dmMono = DM_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-mono",
  weight: ["400", "500"],
});

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  weight: ["700"],
  style: ["normal", "italic"],
});

// Métadonnées localisées : l'export statique précédent servait le titre et la
// description en français sur /en, avec og:locale figé à fr_FR.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo' });

  const title = t('siteTitle');
  const description = t('siteDescription');

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description,
    alternates: buildAlternates(locale),
    openGraph: { ...buildOpenGraph(locale), title, description },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  // Le provider recevait jusqu'ici l'intégralité des messages : sans prop `messages`,
  // next-intl sérialise tout vers le navigateur, sur chaque page. Les dictionnaires
  // pèsent déjà ~70 Ko, et le namespace Editorial n'est lu que côté serveur — il n'a
  // donc aucune raison de traverser le réseau.
  const { Editorial: _editorial, ...clientMessages } = await getMessages();

  return (
    <html lang={locale} data-theme="dark" data-scroll-behavior="smooth">
      <body
        className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider messages={clientMessages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
