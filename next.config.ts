import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Build Docker uniquement (BUILD_STANDALONE=1 posé par le Dockerfile) : produit
  // .next/standalone avec les seules dépendances tracées, ce qui donne une image
  // légère. Sur Vercel la variable est absente, le comportement reste inchangé.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore', '@google-cloud/tasks', 'grpc', '@grpc/grpc-js', '@sparticuz/chromium', 'puppeteer-core'],
  turbopack: {
    root: __dirname,
  },
  // @sparticuz/chromium charge son binaire dynamiquement (pas de require/import statique),
  // le traçage de fichiers de Next.js ne l'inclut donc pas automatiquement dans le bundle serverless.
  outputFileTracingIncludes: {
    '/api/export/set-pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
