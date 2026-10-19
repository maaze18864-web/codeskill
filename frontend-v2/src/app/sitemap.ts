import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: getSiteUrl(''),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: getSiteUrl('/problems'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: getSiteUrl('/contests'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: getSiteUrl('/leaderboard'),
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: getSiteUrl('/skill-development'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: getSiteUrl('/contact'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: getSiteUrl('/privacy'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: getSiteUrl('/terms'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
