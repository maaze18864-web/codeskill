import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { getBaseSiteUrl, getSiteUrl, PRODUCTION_SITE_URL } from '@/lib/site-url';

describe('SEO & Discoverability Metadata (AUD-053)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Site URL normalization', () => {
    it('defaults to the canonical production domain https://codeskill.novaserve.cloud', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_SOCKET_URL;
      expect(getBaseSiteUrl()).toBe(PRODUCTION_SITE_URL);
      expect(getSiteUrl('/problems')).toBe('https://codeskill.novaserve.cloud/problems');
    });

    it('normalizes trailing slashes and builds absolute URLs', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://codeskill.novaserve.cloud///';
      expect(getBaseSiteUrl()).toBe('https://codeskill.novaserve.cloud');
      expect(getSiteUrl('contests')).toBe('https://codeskill.novaserve.cloud/contests');
      expect(getSiteUrl('/contests')).toBe('https://codeskill.novaserve.cloud/contests');
      expect(getSiteUrl('')).toBe('https://codeskill.novaserve.cloud');
      expect(getSiteUrl('/')).toBe('https://codeskill.novaserve.cloud');
    });

    it('rejects localhost hostnames in production mode and falls back to production canonical', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
      expect(getBaseSiteUrl()).toBe(PRODUCTION_SITE_URL);
    });
  });

  describe('Sitemap generation', () => {
    it('generates sitemap with canonical production domain', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_SOCKET_URL;

      const items = sitemap();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(4);

      for (const item of items) {
        expect(item.url).toMatch(/^https:\/\/codeskill\.novaserve\.cloud(\/.*)?$/);
        expect(item.url).not.toContain('codeskill.com');
        expect(item.url).not.toContain('localhost');
        expect(item.lastModified).toBeInstanceOf(Date);
        expect(item.changeFrequency).toBeDefined();
        expect(typeof item.priority).toBe('number');
      }
    });

    it('excludes dead route /discuss and private student portal /assessments', () => {
      const items = sitemap();
      const urls = items.map((i) => i.url);

      expect(urls.some((u) => u.includes('/discuss'))).toBe(false);
      expect(urls.some((u) => u.includes('/assessments'))).toBe(false);
    });

    it('contains all verified public canonical routes without duplicates', () => {
      const items = sitemap();
      const urls = items.map((i) => i.url);

      // No duplicate URLs
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(urls.length);

      // Verified public routes
      expect(urls).toContain('https://codeskill.novaserve.cloud');
      expect(urls).toContain('https://codeskill.novaserve.cloud/problems');
      expect(urls).toContain('https://codeskill.novaserve.cloud/contests');
      expect(urls).toContain('https://codeskill.novaserve.cloud/leaderboard');
      expect(urls).toContain('https://codeskill.novaserve.cloud/skill-development');
      expect(urls).toContain('https://codeskill.novaserve.cloud/contact');
      expect(urls).toContain('https://codeskill.novaserve.cloud/privacy');
      expect(urls).toContain('https://codeskill.novaserve.cloud/terms');
    });
  });

  describe('Robots.txt generation', () => {
    it('references the authoritative production sitemap URL', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_SOCKET_URL;

      const config = robots();
      expect(config.sitemap).toBe('https://codeskill.novaserve.cloud/sitemap.xml');
      expect(config.sitemap).not.toContain('codeskill.com');
    });

    it('allows public crawling while disallowing private, auth, and assessment portals', () => {
      const config = robots();
      const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;

      expect(rules.allow).toContain('/');
      expect(rules.allow).toContain('/_next/static/');
      expect(rules.allow).not.toContain('/discuss');

      // Private routes must be disallowed
      expect(rules.disallow).toContain('/admin/');
      expect(rules.disallow).toContain('/teacher/');
      expect(rules.disallow).toContain('/assessments/');
      expect(rules.disallow).toContain('/campus/');
      expect(rules.disallow).toContain('/company/');
      expect(rules.disallow).toContain('/dashboard/');
      expect(rules.disallow).toContain('/profile/');
      expect(rules.disallow).toContain('/api/');
      expect(rules.disallow).toContain('/login');
      expect(rules.disallow).toContain('/register');
      expect(rules.disallow).toContain('/student-login');
      expect(rules.disallow).toContain('/forgot-password');
    });
  });
});
