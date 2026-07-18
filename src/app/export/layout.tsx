import { DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import "../globals.css";

// Layout racine dédié : /export n'est jamais visité par un humain (cible de rendu
// Puppeteer pour le PDF, voir /api/export/set-pdf), donc volontairement en dehors
// de app/[locale] — pas de locale à détecter/rediriger pour cette route.

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

export default function ExportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="dark" data-scroll-behavior="smooth">
      <body
        className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
