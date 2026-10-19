import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/_next/static/',
        ],
        disallow: [
          '/admin/',
          '/teacher/',
          '/assessments/',
          '/assessment/',
          '/campus/',
          '/company/',
          '/dashboard/',
          '/profile/',
          '/api/',
          '/login',
          '/register',
          '/student-login',
          '/forgot-password',
          '/demo-report',
          '/result-demo',
        ],
      },
    ],
    sitemap: getSiteUrl('/sitemap.xml'),
  };
}
