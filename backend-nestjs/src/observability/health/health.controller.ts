import { Controller, Get, HttpStatus, Post, Body, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health & Telemetry')
@SkipThrottle()
@Controller()
export class HealthAndTelemetryController {
  private cachedReadyState: { status: number; payload: any; expiresAt: number } | null = null;

  constructor(
    @InjectDataSource() private readonly primaryDataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {}

  // 1. Deep Synthetic Probe for Uptime Kuma (:3002) - Never wired to ALB termination
  @Get('health/deep')
  @ApiOperation({ summary: 'Deep Synthetic Health Probe' })
  async getDeepHealth(@Res() res: Response): Promise<void> {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // Check Primary DB
    const dbStart = Date.now();
    try {
      await this.withTimeout(this.primaryDataSource.query('SELECT 1'), 1500);
      checks.postgresPrimary = { status: 'up', latencyMs: Date.now() - dbStart };
    } catch {
      checks.postgresPrimary = { status: 'down' };
    }

    // Check Piston Sandbox Engine
    const pistonUrl =
      process.env.PISTON_URL ||
      process.env.PISTON_BASE_URL ||
      'http://piston.codeskill.internal:2001/api/v2/runtimes';
    const pistonStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const resp = await fetch(pistonUrl, { signal: controller.signal });
      clearTimeout(timeout);
      checks.pistonEngine = {
        status: resp.ok ? 'up' : 'degraded',
        latencyMs: Date.now() - pistonStart,
      };
    } catch {
      checks.pistonEngine = { status: 'down' };
    }

    const allCriticalUp = checks.postgresPrimary?.status === 'up';
    res.status(allCriticalUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: allCriticalUp ? 'healthy' : 'critical',
      dependencies: checks,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Client Error & Web Vitals Ingestion Endpoint (Global prefix 'api' yields /api/telemetry/client-events)
  @Post('telemetry/client-events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Client error & Web Vitals ingestion endpoint' })
  ingestClientTelemetry(@Body() body: Record<string, any>): void {
    this.logger.warn(
      {
        telemetryType: 'frontend_client_event',
        clientEvent: body,
      },
      `Frontend telemetry event: ${body?.type || 'unknown'}`,
    );
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Probe timeout')), ms);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }
}
