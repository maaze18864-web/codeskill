/** The API resolves this capability from the live account, not client input. */
export function hasLabsAccess(
  user?: { features?: { labs?: boolean } } | null,
): boolean {
  return user?.features?.labs === true;
}
