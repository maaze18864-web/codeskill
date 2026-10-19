jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => {} }));

import { ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ExamSecurityService } from './exam-security.service';

describe('ExamSecurityService (ISSUE-SEC-001 Hardening)', () => {
  let service: ExamSecurityService;
  let assessmentRepo: any;
  let sessionRepo: any;
  let eventRepo: any;

  beforeEach(() => {
    assessmentRepo = {
      findOne: jest.fn(),
    };
    sessionRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((e) => ({ ...e, id: 'session-uuid-1' })),
      save: jest.fn().mockImplementation(async (e) => e),
    };
    eventRepo = {
      save: jest.fn(),
    };

    service = new ExamSecurityService(
      assessmentRepo as never,
      sessionRepo as never,
      eventRepo as never,
    );
  });

  it('rejects connection with ForbiddenException when assessment requires SEB but client is standard browser', async () => {
    assessmentRepo.findOne.mockResolvedValue({
      id: 'asmt-1',
      securityPolicy: {
        requireSEB: true,
      },
    });

    await expect(
      service.initSecureSession('asmt-1', 'cand-1', { isSEB: false }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects connection when assessment requires specific configKey and client provides plaintext body key without authentic SEB header hash (ISSUE-SEC-002)', async () => {
    assessmentRepo.findOne.mockResolvedValue({
      id: 'asmt-1',
      securityPolicy: {
        requireSEB: true,
        configKey: 'secret-exam-config-key-12345',
      },
    });

    await expect(
      service.initSecureSession(
        'asmt-1',
        'cand-1',
        { isSEB: true, configKey: 'secret-exam-config-key-12345' },
        { 'user-agent': 'SafeExamBrowser/3.3.0' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects connection when SEB header hash is mismatched or invalid', async () => {
    assessmentRepo.findOne.mockResolvedValue({
      id: 'asmt-1',
      securityPolicy: {
        requireSEB: true,
        configKey: 'secret-exam-config-key-12345',
      },
    });

    await expect(
      service.initSecureSession(
        'asmt-1',
        'cand-1',
        { isSEB: true },
        {
          'user-agent': 'SafeExamBrowser/3.3.0',
          'x-safeexambrowser-requesthash': 'invalidhash1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('accepts genuine SEB connection with valid URL request hash and returns cryptographically signed HMAC token', async () => {
    assessmentRepo.findOne.mockResolvedValue({
      id: 'asmt-1',
      durationMinutes: 60,
      securityPolicy: {
        requireSEB: true,
        configKey: 'approved-config-key',
      },
    });
    sessionRepo.findOne.mockResolvedValue(null);

    const fullUrl = 'https://exam.codeskill.io/exam-security/asmt-1/secure-session/init';
    const validSebHash = crypto
      .createHash('sha256')
      .update(fullUrl + 'approved-config-key')
      .digest('hex');

    const res = await service.initSecureSession(
      'asmt-1',
      'cand-1',
      { isSEB: true },
      {
        'user-agent': 'SafeExamBrowser/3.3.0',
        'x-safeexambrowser-requesthash': validSebHash,
      },
      fullUrl,
    );

    expect(res.success).toBe(true);
    expect(res.sessionId).toBe('session-uuid-1');
    expect(res.token).not.toBe('simulate-secure-token');
    // Valid SHA-256 HMAC is a 64-character hexadecimal string
    expect(res.token).toMatch(/^[a-f0-9]{64}$/);
  });
});
