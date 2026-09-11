import type { MetadataRoute } from 'next';

const paths = ['', '/download', '/support', '/updates', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.paytsek.online';
  return paths.map((path) => ({ url: `${site}${path}`, lastModified: new Date(), changeFrequency: path === '' ? 'weekly' : 'monthly', priority: path === '' ? 1 : 0.6 }));
}
