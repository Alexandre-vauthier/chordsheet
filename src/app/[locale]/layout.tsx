import type { Metadata } from "next";
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://chordsheet.app';
const SITE_TITLE = "ChordSheet - Grilles d'accords pour musiciens";
const SITE_DESCRIPTION = "Créez, partagez et consultez vos grilles d'accords. L'outil collaboratif pour musiciens.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | ChordSheet',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: BASE_URL,
    siteName: 'ChordSheet',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

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

  return (
    <html lang={locale} data-theme="dark" data-scroll-behavior="smooth">
      <body
        className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
