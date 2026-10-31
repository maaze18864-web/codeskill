import { ADMIN_ROLES } from '../guards/admin.guard';

export const LABS_PILOT_EMAIL = 'vk@student.in';

interface LabsUser {
  email?: string;
  role?: string;
  isAdmin?: boolean;
  profile?: { labsAccessDisabled?: boolean } | null;
}

/** Rollout policy, evaluated against the live account loaded by JWT auth. */
export function canAccessLabs(user?: LabsUser | null): boolean {
  if (!user) return false;
  const role = user.role?.trim().toLowerCase();
  if (user.isAdmin === true || ADMIN_ROLES.includes(role || '')) return true;

  return (
    role === 'student' &&
    user.email?.trim().toLowerCase() === LABS_PILOT_EMAIL &&
    (user.profile?.labsAccessDisabled === undefined ||
      user.profile.labsAccessDisabled === false)
  );
}
