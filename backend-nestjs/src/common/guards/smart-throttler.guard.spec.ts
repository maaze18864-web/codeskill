import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SmartThrottlerGuard } from './smart-throttler.guard';
import * as jwt from 'jsonwebtoken';

describe('SmartThrottlerGuard', () => {
  let guard: SmartThrottlerGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const mockSecret = 'super-secure-test-jwt-secret-min-32-chars-long';
  const mockJwtSettings = {
    secret: mockSecret,
    accessTtlSeconds: 900,
    refreshTtlSeconds: 604800,
    issuer: 'codeskill-test',
    audience: 'codeskill-client',
  };

  beforeEach(() => {
    reflector = new Reflector();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt') return mockJwtSettings;
        if (key === 'EXAM_CENTER_SECRET') return 'exam-secret-test-123';
        return undefined;
      }),
    } as unknown as ConfigService;

    const mockThrottlerOptions = {
      throttlers: [{ name: 'default', ttl: 60000, limit: 120 }],
    };
    const mockStorage = {
      increment: jest.fn(),
    };

    guard = new SmartThrottlerGuard(
      mockThrottlerOptions as any,
      mockStorage as any,
      reflector,
      configService,
    );
  });

  describe('getTracker', () => {
    it('uses usr:<id> when req.user is already attached', async () => {
      const req: any = {
        user: { id: 'user-uuid-123' },
        ip: '192.168.1.1',
      };

      // Call protected method
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('usr:user-uuid-123');
    });

    it('extracts and verifies valid Bearer JWT token to return usr:<id>', async () => {
      const token = jwt.sign(
        { id: 'student-uuid-456' },
        mockSecret,
        {
          algorithm: 'HS256',
          issuer: mockJwtSettings.issuer,
          audience: mockJwtSettings.audience,
          expiresIn: '15m',
        },
      );

      const req: any = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        ip: '198.51.100.1',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('usr:student-uuid-456');
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('student-uuid-456');
    });

    it('isolates different students sharing the same Campus NAT IP address', async () => {
      const sharedCampusIp = '203.0.113.10';

      const tokenStudentA = jwt.sign(
        { id: 'alice-student-id' },
        mockSecret,
        {
          algorithm: 'HS256',
          issuer: mockJwtSettings.issuer,
          audience: mockJwtSettings.audience,
        },
      );

      const tokenStudentB = jwt.sign(
        { id: 'bob-student-id' },
        mockSecret,
        {
          algorithm: 'HS256',
          issuer: mockJwtSettings.issuer,
          audience: mockJwtSettings.audience,
        },
      );

      const reqA: any = {
        headers: { authorization: `Bearer ${tokenStudentA}` },
        ip: sharedCampusIp,
      };

      const reqB: any = {
        headers: { authorization: `Bearer ${tokenStudentB}` },
        ip: sharedCampusIp,
      };

      const trackerA = await (guard as any).getTracker(reqA);
      const trackerB = await (guard as any).getTracker(reqB);

      expect(trackerA).toBe('usr:alice-student-id');
      expect(trackerB).toBe('usr:bob-student-id');
      expect(trackerA).not.toBe(trackerB);
    });

    it('falls back to IP tracking when Bearer token is invalid or forged', async () => {
      const req: any = {
        headers: {
          authorization: 'Bearer forged.invalid.token',
        },
        ip: '198.51.100.42',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:198.51.100.42');
      expect(req.user).toBeUndefined();
    });

    it('buckets login attempts by IP and hashed account identifier', async () => {
      const reqAlice: any = {
        body: { email: 'alice@university.edu', password: 'secret' },
        ip: '203.0.113.50',
      };

      const reqBob: any = {
        body: { email: 'bob@university.edu', password: 'secret' },
        ip: '203.0.113.50',
      };

      const trackerAlice = await (guard as any).getTracker(reqAlice);
      const trackerBob = await (guard as any).getTracker(reqBob);

      expect(trackerAlice).toMatch(/^login:203\.0\.113\.50:[a-f0-9]{16}$/);
      expect(trackerBob).toMatch(/^login:203\.0\.113\.50:[a-f0-9]{16}$/);
      expect(trackerAlice).not.toBe(trackerBob);
    });

    it('buckets proctored exam stations with verified secret', async () => {
      const req: any = {
        headers: {
          'x-exam-station-id': 'lab-3-workstation-12',
          'x-exam-center-secret': 'exam-secret-test-123',
        },
        ip: '10.0.0.15',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('station:lab-3-workstation-12');
    });

    it('falls back to client IP from X-Forwarded-For header', async () => {
      const req: any = {
        headers: {
          'x-forwarded-for': '198.51.100.77, 10.0.0.1',
        },
        ip: '10.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:198.51.100.77');
    });

    it('rejects spoofed X-Forwarded-For headers and resolves true client IP from proxy chain (ISSUE-SEC-003)', async () => {
      // Attacker sends spoofed IP 1.2.3.4; ALB appends real client IP 203.0.113.88
      const req: any = {
        headers: {
          'x-forwarded-for': '1.2.3.4, 203.0.113.88, 10.0.1.5',
        },
        ip: '10.0.1.5',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:203.0.113.88');
      expect(tracker).not.toBe('ip:1.2.3.4');
    });
  });

  describe('shouldSkip', () => {
    it('returns true when handler is decorated with @SkipThrottle()', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'THROTTLER:SKIPdefault') return true;
        return undefined;
      });

      const mockContext = {
        getHandler: () => () => {},
        getClass: () => class {},
      } as unknown as ExecutionContext;

      const result = await (guard as any).shouldSkip(mockContext);
      expect(result).toBe(true);
    });

    it('returns false when handler is not skipped', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const mockContext = {
        getHandler: () => () => {},
        getClass: () => class {},
      } as unknown as ExecutionContext;

      const result = await (guard as any).shouldSkip(mockContext);
      expect(result).toBe(false);
    });
  });
});
