import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'crypto';
import { RedisService } from './redis.service';
import { EmailService } from '../emails/email.service';
import { OTP_TTL_SECONDS } from './otp.constants';

/**
 * A code is only valid for the purpose it was issued for, so a password-reset
 * code cannot be replayed to log in (or the other way round).
 */
export type OtpPurpose = 'login' | 'password_reset' | 'admin_login';

export { OTP_TTL_SECONDS };
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Atomic verify-and-consume.
 *
 * KEYS[1] code digest, KEYS[2] attempt counter (same {hash-tag} => same
 * Redis Cluster slot). Returns: 1 success, 0 wrong code, -1 missing/expired,
 * -2 attempt budget exhausted (code destroyed).
 */
const VERIFY_SCRIPT = `
local stored = redis.call('GET', KEYS[1])
if not stored then
  redis.call('DEL', KEYS[2])
  return -1
end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3])) end
if attempts > tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1], KEYS[2])
  return -2
end
if stored == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
end
return 0
`;

const UNAVAILABLE = 'Verification service is temporarily unavailable. Please try again shortly.';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private generateOTP(): string {
    // Uniform 6 digit code incl. leading zeros.
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private normalize(email: unknown): string {
    if (typeof email !== 'string' || !email.trim()) {
      throw new BadRequestException('A valid email address is required.');
    }
    const normalized = email.trim().toLowerCase();
    // Braces delimit the Redis Cluster hash tag; never allow them in the tag.
    if (/[{}\s]/.test(normalized) || normalized.length > 254) {
      throw new BadRequestException('A valid email address is required.');
    }
    return normalized;
  }

  private keys(email: string, purpose: OtpPurpose) {
    const base = `otp:{${email}}:${purpose}`;
    return {
      code: base,
      attempts: `${base}:attempts`,
      cooldown: `${base}:cooldown`,
    };
  }

  /** Only a keyed digest of the code is stored, bound to email and purpose. */
  private digest(email: string, purpose: OtpPurpose, code: string): string {
    const pepper =
      process.env.OTP_PEPPER ||
      createHmac('sha256', this.configService.getOrThrow<{ secret: string }>('jwt').secret)
        .update('codeskill-otp-pepper')
        .digest('hex');
    return createHmac('sha256', pepper)
      .update(`${purpose}\u0000${email}\u0000${code}`)
      .digest('hex');
  }

  async sendOTP(
    email: string,
    purpose: OtpPurpose = 'login',
  ): Promise<{ success: boolean; message: string }> {
    const normalized = this.normalize(email);
    const k = this.keys(normalized, purpose);
    const client = this.redisService.getClient();

    try {
      // Atomic cooldown: SET NX is the only gate, there is no get-then-set race.
      const acquired = await client.set(k.cooldown, '1', 'EX', OTP_COOLDOWN_SECONDS, 'NX');
      if (acquired !== 'OK') {
        throw new HttpException(
          'Please wait before requesting another OTP.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const otp = this.generateOTP();
      await client
        .multi()
        .set(k.code, this.digest(normalized, purpose, otp), 'EX', OTP_TTL_SECONDS)
        .del(k.attempts)
        .exec()
        .then((results) => {
          if (!results || results.some(([err]) => err)) {
            throw new Error('Failed to persist OTP');
          }
        });

      try {
        await this.emailService.sendOTPEmail(normalized, otp);
      } catch (error) {
        await client.del(k.code, k.cooldown).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `OTP send failed (${purpose}): ${(error as Error)?.message ?? 'unknown error'}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    return { success: true, message: 'OTP sent successfully' };
  }

  /** Throws unless the code is valid; consumes it atomically on success. */
  async verifyOTP(
    email: string,
    code: string,
    purpose: OtpPurpose = 'login',
  ): Promise<true> {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      throw new BadRequestException('Invalid or expired verification code.');
    }
    const normalized = this.normalize(email);
    const k = this.keys(normalized, purpose);
    const client = this.redisService.getClient();

    let outcome: number;
    try {
      outcome = Number(
        await client.eval(
          VERIFY_SCRIPT,
          2,
          k.code,
          k.attempts,
          this.digest(normalized, purpose, code.trim()),
          OTP_MAX_ATTEMPTS,
          OTP_TTL_SECONDS,
        ),
      );
    } catch (error) {
      // Fail closed: if Redis cannot confirm the code, authentication fails.
      this.logger.error(
        `OTP verify failed (${purpose}): ${(error as Error)?.message ?? 'unknown error'}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    if (outcome === 1) return true;
    if (outcome === -2) {
      throw new HttpException(
        'Too many incorrect attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new BadRequestException('Invalid or expired verification code.');
  }
}
