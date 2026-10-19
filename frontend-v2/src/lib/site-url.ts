/**
 * Canonical Site URL configuration & normalization utility.
 * Resolves AUD-053: Ensures SEO metadata, sitemap.xml, and robots.txt
 * always resolve to the authoritative production domain: https://codeskill.novaserve.cloud
 */

export const PRODUCTION_SITE_URL = 'https://codeskill.novaserve.cloud';

/**
 * Resolves the canonical base URL for the application.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL
 * 2. NEXT_PUBLIC_APP_URL
 * 3. NEXT_PUBLIC_SOCKET_URL
 * 4. Fallback: https://codeskill.novaserve.cloud
 *
 * In production mode (`NODE_ENV === 'production'`), local development hosts
 * (localhost, 127.0.0.1) are strictly rejected to prevent dev leaks into SEO assets.
 */
export function getBaseSiteUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    try {
      const parsed = new URL(trimmed);
      const isLocalHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);

      if (process.env.NODE_ENV === 'production' && isLocalHost) {
        return PRODUCTION_SITE_URL;
      }

      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return PRODUCTION_SITE_URL;
    }
  }

  return PRODUCTION_SITE_URL;
}

/**
 * Builds an absolute canonical URL for a given path.
 *
 * @param path Relative path (e.g., "/problems" or "problems")
 * @returns Absolute normalized HTTPS URL (e.g., "https://codeskill.novaserve.cloud/problems")
 */
export function getSiteUrl(path: string = ''): string {
  const base = getBaseSiteUrl();
  if (!path || path === '/') {
    return base;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
