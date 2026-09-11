import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PayTsek',
    short_name: 'PayTsek',
    description: 'QR payment records for Philippine sellers.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8fb',
    theme_color: '#0B5FFF',
    icons: [{ src: '/brand/paytsek-icon.png', sizes: 'any', type: 'image/png' }],
  };
}
