import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://chordsheet.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/dashboard', '/profile', '/sheet/*/edit', '/sheet/new'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
