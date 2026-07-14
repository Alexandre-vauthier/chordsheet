import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ChordSheet',
    short_name: 'ChordSheet',
    description: "Créez, partagez et consultez vos grilles d'accords. L'outil collaboratif pour musiciens.",
    start_url: '/explore',
    display: 'standalone',
    background_color: '#1a1410',
    theme_color: '#1a1410',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
