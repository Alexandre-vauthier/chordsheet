import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore', 'grpc', '@grpc/grpc-js', '@sparticuz/chromium', 'puppeteer-core'],
  turbopack: {
    root: __dirname,
  },
  // @sparticuz/chromium charge son binaire dynamiquement (pas de require/import statique),
  // le traçage de fichiers de Next.js ne l'inclut donc pas automatiquement dans le bundle serverless.
  outputFileTracingIncludes: {
    '/api/export/set-pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
