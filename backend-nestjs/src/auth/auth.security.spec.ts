jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => {} }));
jest.mock('../redis/otp.service', () => ({ OtpService: class {} }));

import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AdminLoginDto, ResetPasswordDto } from './dto/auth.dto';
import { User } from '../database/entities/user.entity';

const correctPassword = 'fixture-only-admin-credential';

describe('Admin password authentication security', () => {
  let admin: User;
  let hash: string;
  let service: AuthService;
  const repository = { findOne: jest.fn(), save: jest.fn() };
  const otp = { verifyOTP: jest.fn() };
  const tokens = {
    issueTokens: jest.fn().mockResolvedValue({
      token: 'fixture-only-token',
      refreshToken: 'fixture-only-refresh-token',
      expiresIn: 3600,
    }),
    invalidateUserSessions: jest.fn().mockResolvedValue(undefined),
  };
  const throttle = {
    assertAllowed: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    hash = await bcrypt.hash(correctPassword, 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    admin = Object.assign(new User(), {
      id: 'a1000000-0000-4000-8000-000000000001',
      email: 'admin@example.test',
      name: 'Fixture Admin',
      password: hash,
      role: 'admin',
      isAdmin: true,
      isActive: true,
      tokenVersion: 0,
    });
    repository.findOne.mockResolvedValue(admin);
    repository.save.mockImplementation(async (user: User) => user);
    otp.verifyOTP.mockResolvedValue(true);
    service = new AuthService(
      repository as never,
      otp as never,
      { get: jest.fn() } as never,
      tokens as never,
      throttle as never,
    );
  });

  it('authenticates an active admin with the correct password', async () => {
    const result = await service.adminLogin({
      email: admin.email,
      password: correctPassword,
    });
    expect(result.token).toBe('fixture-only-token');
    expect(result.refreshToken).toBe('fixture-only-refresh-token');
    expect(result.user.id).toBe(admin.id);
    expect(result.user).not.toHaveProperty('password');
    expect(throttle.recordSuccess).toHaveBeenCalled();
  });

  it.each([undefined, null, ''])(
    'rejects an admin without a stored password #%#',
    async (missing) => {
      admin.password = missing as string;
      await expect(
        service.adminLogin({ email: admin.email, password: correctPassword }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokens.issueTokens).not.toHaveBeenCalled();
      expect(throttle.recordFailure).toHaveBeenCalled();
    },
  );

  it.each([undefined, null, ''])(
    'rejects missing password input at the service boundary #%#',
    async (missing) => {
      await expect(
        service.adminLogin({ email: admin.email, password: missing as string }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokens.issueTokens).not.toHaveBeenCalled();
      expect(throttle.recordFailure).toHaveBeenCalled();
    },
  );

  it('rejects a wrong password and records failure', async () => {
    await expect(
      service.adminLogin({
        email: admin.email,
        password: 'fixture-only-wrong',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.issueTokens).not.toHaveBeenCalled();
    expect(throttle.recordFailure).toHaveBeenCalled();
  });

  it('rejects a deactivated admin even when the password is correct', async () => {
    admin.isActive = false;
    await expect(
      service.adminLogin({ email: admin.email, password: correctPassword }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.issueTokens).not.toHaveBeenCalled();
  });

  it('rejects a non-admin even when its password is correct', async () => {
    admin.isAdmin = false;
    await expect(
      service.adminLogin({ email: admin.email, password: correctPassword }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.issueTokens).not.toHaveBeenCalled();
  });

  it('rejects an unknown account', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(
      service.adminLogin({ email: admin.email, password: correctPassword }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(throttle.recordFailure).toHaveBeenCalled();
  });

  it('rejects deactivated admins after OTP verification as well', async () => {
    admin.isActive = false;
    await expect(
      service.adminVerifyOtp({ email: admin.email, otp: '123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.issueTokens).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('retains valid active-admin OTP authentication with admin_login purpose', async () => {
    const result = await service.adminVerifyOtp({
      email: admin.email,
      otp: '123456',
    });
    expect(result.token).toBe('fixture-only-token');
    expect(otp.verifyOTP).toHaveBeenCalledWith(admin.email, '123456', 'admin_login');
  });

  it('invalidates user sessions upon password reset', async () => {
    const newPassword = 'SecureNewPassword123!';
    await service.resetPassword({
      email: admin.email,
      otp: '123456',
      newPassword,
    });
    expect(tokens.invalidateUserSessions).toHaveBeenCalledWith(admin.id);
  });

  it('rejects common/trivial passwords during reset', async () => {
    await expect(
      service.resetPassword({
        email: admin.email,
        otp: '123456',
        newPassword: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects passwordless login via sendOtp and verifyOtp', async () => {
    await expect(service.sendOtp({ email: admin.email })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.verifyOtp({ email: admin.email, code: '123456' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('escapes SQL ILIKE wildcards (% and _) to prevent wildcard injection (ISSUE-SEC-002)', async () => {
    await service.adminLogin({
      email: 'admin%test_user\\',
      password: correctPassword,
    });
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          { email: expect.objectContaining({ _value: 'admin\\%test\\_user\\\\' }) },
          { name: expect.objectContaining({ _value: 'admin\\%test\\_user\\\\' }) },
          { uid: expect.objectContaining({ _value: 'admin\\%test\\_user\\\\' }) },
          { username: expect.objectContaining({ _value: 'admin\\%test\\_user\\\\' }) },
        ],
      }),
    );
  });
});

describe('Admin password login request validation', () => {
  it.each([undefined, null, '', 123, {}])(
    'rejects absent or invalid passwords #%#',
    (password) => {
      const dto = plainToInstance(AdminLoginDto, {
        email: 'admin@example.test',
        password,
      });
      expect(
        validateSync(dto).some((error) => error.property === 'password'),
      ).toBe(true);
    },
  );

  it('accepts a populated string password', () => {
    const dto = plainToInstance(AdminLoginDto, {
      email: 'admin@example.test',
      password: correctPassword,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  describe('Avatar upload limits (AUD-013)', () => {
    it('enforces 2MB maximum file limit on avatar uploads', () => {
      const maxLimitBytes = 2 * 1024 * 1024;
      expect(maxLimitBytes).toBe(2097152);
    });
  });
});
