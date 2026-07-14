import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://chordsheet.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/explore',
    '/pricing',
    '/chords',
    '/login',
    '/register',
    '/legal/cgu',
    '/legal/cgv',
    '/legal/confidentialite',
    '/legal/mentions-legales',
  ];

  return staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
