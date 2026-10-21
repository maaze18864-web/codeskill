/**
 * Authoritative Section Options Configuration
 *
 * The supported section list across CodeSkill:
 * A1, A2, A3, B1, B2, B3, B4, C1, C2, C3
 */

export const SUPPORTED_SECTIONS = [
  "A1",
  "A2",
  "A3",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
] as const;

export type SupportedSection = (typeof SUPPORTED_SECTIONS)[number];

export function isSupportedSection(value: unknown): value is SupportedSection {
  return typeof value === "string" && (SUPPORTED_SECTIONS as readonly string[]).includes(value);
}

/**
 * Returns a normalized list of section options for display/selection.
 * Ensures the 10 standard sections are always present in the required order,
 * while preserving any existing legacy values already assigned to a record.
 */
export function getStandardizedSectionOptions(existingSections: string[] = []): string[] {
  const standardSet = new Set<string>(SUPPORTED_SECTIONS);
  const legacySections = existingSections.filter(
    (sec) => sec && !standardSet.has(sec),
  );
  return [...SUPPORTED_SECTIONS, ...legacySections];
}
