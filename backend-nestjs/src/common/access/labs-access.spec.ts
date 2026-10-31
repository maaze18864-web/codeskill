import { ADMIN_ROLES } from '../guards/admin.guard';
import { canAccessLabs, LABS_PILOT_EMAIL } from './labs-access';

describe('Labs rollout access', () => {
  it('allows only the configured pilot student', () => {
    expect(canAccessLabs({ role: 'student', email: LABS_PILOT_EMAIL })).toBe(
      true,
    );
    expect(canAccessLabs({ role: 'student', email: 'other@student.in' })).toBe(
      false,
    );
  });

  it('keeps every existing admin role enabled', () => {
    for (const role of ADMIN_ROLES) {
      expect(canAccessLabs({ role, email: 'admin@example.test' })).toBe(true);
    }
    expect(
      canAccessLabs({
        isAdmin: true,
        role: 'student',
        email: 'admin@example.test',
      }),
    ).toBe(true);
  });

  it('honors the production disable switch only for the pilot', () => {
    expect(
      canAccessLabs({
        role: 'student',
        email: LABS_PILOT_EMAIL,
        profile: { labsAccessDisabled: true },
      }),
    ).toBe(false);
    expect(
      canAccessLabs({
        role: 'student',
        email: LABS_PILOT_EMAIL,
        profile: { labsAccessDisabled: false },
      }),
    ).toBe(true);
  });
});
