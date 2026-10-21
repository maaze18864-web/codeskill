/**
 * Authoritative Section Options Configuration
 *
 * The standard supported section list across CodeSkill:
 * A1, A2, A3, B1, B2, B3, B4, C1, C2, C3
 */

export const SUPPORTED_SECTIONS = [
  'A1',
  'A2',
  'A3',
  'B1',
  'B2',
  'B3',
  'B4',
  'C1',
  'C2',
  'C3',
] as const;

export type SupportedSection = (typeof SUPPORTED_SECTIONS)[number];

export const SUPPORTED_SECTION_SET = new Set<string>(SUPPORTED_SECTIONS);

/**
 * Checks if a section value is one of the 10 standard supported sections.
 */
export function isSupportedSection(value: unknown): value is SupportedSection {
  return typeof value === 'string' && SUPPORTED_SECTION_SET.has(value);
}

/**
 * Normalizes a section string to its canonical supported identifier (e.g. 'a1' -> 'A1', 'sec a1' -> 'A1').
 * If it matches a supported section, returns the canonical uppercase form ('A1'..'C3').
 * If it's a legacy or custom section (e.g. 'CSE-A', 'A'), returns the trimmed value.
 */
export function normalizeSectionIdentifier(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // Clean common prefixes like 'Section ', 'Sec ', etc.
  const stripped = str.replace(/^sec(tion)?[\s_\-]*/i, '').trim().toUpperCase();
  if (SUPPORTED_SECTION_SET.has(stripped)) {
    return stripped;
  }
  // Check exact case-insensitive match against standard
  const matched = SUPPORTED_SECTIONS.find(
    (sec) => sec.toLowerCase() === str.toLowerCase(),
  );
  if (matched) return matched;

  // Return trimmed original value for legacy compatibility
  return str;
}

/**
 * Validates whether a section string is valid:
 * Returns true if it's in the supported set or conforms to known legacy format.
 * Returns false if it contains invalid characters or malformed tokens.
 */
export function isValidSectionFormat(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isSupportedSection(normalizeSectionIdentifier(trimmed))) return true;
  // Legacy allowed format: alphanumeric with hyphen, e.g. 'CSE-A', 'A'
  return /^[A-Za-z0-9_\-]{1,16}$/.test(trimmed);
}
