import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  ThrottlerGuard,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { JwtSettings } from '../../config/jwt.config';

/**
 * SmartThrottlerGuard
 *
 * Solves the "Campus NAT Trap" (where hundreds of students sharing a single
 * institutional gateway or load-test IP trip global IP throttlers):
 *
 * 1. Authenticated traffic is bucketed by cryptographically verified user identity (`usr:<userId>`).
 * 2. Login attempts are bucketed by account identifier (`login:<ip>:<hash(identifier)>`),
 *    preventing one student's retries from exhausting the entire campus allowance.
 * 3. Proctored exam stations with verified center secrets are bucketed per station (`station:<id>`).
 * 4. Anonymous public traffic falls back to client IP (`ip:<clientIp>`).
 * 5. General `@SkipThrottle()` decorators are honored globally across all named throttlers.
 */
@Injectable()
export class SmartThrottlerGuard extends ThrottlerGuard {
  protected readonly logger = new Logger(SmartThrottlerGuard.name);
  private readonly jwtSettings?: JwtSettings;
  private readonly examCenterSecret?: string;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.jwtSettings = this.configService.get<JwtSettings>('jwt');
    this.examCenterSecret = this.configService.get<string>('EXAM_CENTER_SECRET');
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Honor default @SkipThrottle() across all named throttlers
    const defaultSkip = this.reflector.getAllAndOverride<boolean>(
      'THROTTLER:SKIPdefault',
      [handler, classRef],
    );
    if (defaultSkip) {
      return true;
    }

    return super.shouldSkip(context);
  }

  protected async getTracker(
    req: Record<string, any>,
    _context?: ExecutionContext,
  ): Promise<string> {
    // 1. User already verified and attached to request (e.g. by auth guard or middleware)
    const existingUser = req.user;
    if (existingUser && (existingUser.id || existingUser._id || existingUser.sub)) {
      const uid = existingUser.id || existingUser._id || existingUser.sub;
      return `usr:${uid}`;
    }

    // 2. Cryptographically verify Bearer token from Authorization header if present
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token && this.jwtSettings?.secret) {
        try {
          const payload = jwt.verify(token, this.jwtSettings.secret, {
            algorithms: ['HS256'],
            issuer: this.jwtSettings.issuer,
            audience: this.jwtSettings.audience,
          }) as { id?: string; sub?: string; _id?: string };

          const verifiedId = payload.id || payload.sub || payload._id;
          if (verifiedId) {
            req.user = req.user || payload;
            return `usr:${verifiedId}`;
          }
        } catch {
          // Token is expired, invalid, or forged. Fall through to IP tracking.
        }
      }
    }

    // 3. Proctored Exam Center Station Header
    const stationId = req.headers?.['x-exam-station-id'];
    const centerSecretHeader = req.headers?.['x-exam-center-secret'];
    if (
      typeof stationId === 'string' &&
      stationId.trim().length > 0 &&
      this.examCenterSecret &&
      centerSecretHeader === this.examCenterSecret
    ) {
      return `station:${stationId.trim()}`;
    }

    const clientIp = this.resolveClientIp(req);

    // 4. Login Attempt: bucket per (IP + account identifier hash)
    const body = req.body;
    if (body && typeof body === 'object') {
      const rawIdentifier =
        body.email || body.uid || body.username || body.identifier;
      if (typeof rawIdentifier === 'string' && rawIdentifier.trim().length > 0) {
        const hash = createHash('sha256')
          .update(rawIdentifier.trim().toLowerCase())
          .digest('hex')
          .slice(0, 16);
        return `login:${clientIp}:${hash}`;
      }
    }

    // 5. Default: client IP
    return `ip:${clientIp}`;
  }

  private isPrivateIp(ip: string): boolean {
    if (!ip) return false;
    const clean = ip.replace(/^::ffff:/, '').trim();
    if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
    if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
    return false;
  }

  private resolveClientIp(req: Record<string, any>): string {
    // 1. If Express trust proxy has resolved a trusted client IP that is public, use it
    if (
      typeof req.ip === 'string' &&
      req.ip.length > 0 &&
      req.ip !== 'unknown' &&
      !this.isPrivateIp(req.ip)
    ) {
      return req.ip;
    }

    // 2. Parse X-Forwarded-For securely: only trust hops appended by managed reverse proxy (ISSUE-SEC-003)
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const parts = forwarded
        .split(',')
        .map((p: string) => p.trim())
        .filter(Boolean);
      // Scan right-to-left from the trusted proxy to find the true client IP
      for (let i = parts.length - 1; i >= 0; i--) {
        if (!this.isPrivateIp(parts[i])) {
          return parts[i];
        }
      }
      if (parts.length > 0) return parts[0];
    }

    if (Array.isArray(req.ips) && req.ips.length > 0) {
      for (let i = req.ips.length - 1; i >= 0; i--) {
        if (!this.isPrivateIp(req.ips[i])) {
          return req.ips[i];
        }
      }
      return req.ips[0];
    }

    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  }
}
