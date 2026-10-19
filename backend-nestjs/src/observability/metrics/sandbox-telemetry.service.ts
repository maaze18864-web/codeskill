import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import * as diagnostics_channel from 'diagnostics_channel';
import { PinoLogger } from 'nestjs-pino';
import { MetricsService } from './metrics.service';
import { RequestContextService } from '../context/request-context.service';

@Injectable()
export class SandboxTelemetryService implements OnModuleInit, OnModuleDestroy {
  private pollInterval?: NodeJS.Timeout;
  private isHttpHooked = false;
  private originalHttpRequest?: typeof http.request;
  private originalHttpsRequest?: typeof https.request;
  private readonly requestTimings = new WeakMap<
    object,
    { start: bigint; engine: 'piston' | 'judge0'; endpoint: string }
  >();

  constructor(
    private readonly metricsService: MetricsService,
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.hookNodeHttpOutgoing();
    this.hookUndiciFetchOutgoing();
    this.startJudge0QueuePoller();
  }

  /**
   * 1. Passively intercepts Axios / http.request calls to Piston & Judge0
   */
  private hookNodeHttpOutgoing(): void {
    if (this.isHttpHooked) return;
    this.isHttpHooked = true;

    this.originalHttpRequest = http.request;
    this.originalHttpsRequest = https.request;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const wrapRequest = (originalRequest: typeof http.request) => {
      return function (this: any, ...args: any[]): http.ClientRequest {
        const req: http.ClientRequest = originalRequest.apply(this, args as any);
        try {
          const host = String(req.getHeader('host') || '');
          const path = req.path || '/';
          const engine = self.detectEngine(host, path);

          if (engine) {
            const traceId = RequestContextService.getTraceId();
            if (!req.headersSent && !req.getHeader('x-request-id')) {
              req.setHeader('x-request-id', traceId);
            }

            const start = process.hrtime.bigint();
            const normalizedEndpoint = self.normalizeEndpoint(path);

            req.once('response', (res: http.IncomingMessage) => {
              const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
              const statusCode = String(res.statusCode || 200);

              self.metricsService.sandboxHttpDuration.observe(
                { engine, endpoint: normalizedEndpoint, status_code: statusCode },
                durationSeconds,
              );

              if ((res.statusCode || 200) >= 500 || res.statusCode === 429) {
                self.metricsService.sandboxFailureTotal.inc({
                  engine,
                  error_type: `http_${statusCode}`,
                });
                self.logger.error(
                  {
                    traceId,
                    engine,
                    endpoint: normalizedEndpoint,
                    statusCode: res.statusCode,
                    durationMs: Math.round(durationSeconds * 1000),
                  },
                  `${engine.toUpperCase()} sandbox returned HTTP ${statusCode}`,
                );
              }
            });

            req.once('error', (err: Error) => {
              const errorType = err.message.includes('timeout') ? 'timeout' : 'network_error';
              self.metricsService.sandboxFailureTotal.inc({ engine, error_type: errorType });
              self.logger.error(
                {
                  traceId,
                  engine,
                  endpoint: normalizedEndpoint,
                  error: err.message,
                },
                `${engine.toUpperCase()} sandbox network/timeout failure`,
              );
            });
          }
        } catch {
          // Fail-open: never disrupt outbound execution request
        }
        return req;
      };
    };

    try {
      Object.defineProperty(http, 'request', {
        value: wrapRequest(http.request),
        configurable: true,
        writable: true,
      });
      Object.defineProperty(https, 'request', {
        value: wrapRequest(https.request as any) as any,
        configurable: true,
        writable: true,
      });
    } catch {
      // Fail-open: if property cannot be redefined, diagnostics_channel covers outbound requests
    }
  }

  /**
   * 2. Passively intercepts native Node.js fetch (undici) calls to Piston & Judge0
   */
  private hookUndiciFetchOutgoing(): void {
    try {
      diagnostics_channel.subscribe('undici:request:create', ({ request }: any) => {
        const origin = String(request?.origin || '');
        const path = String(request?.path || '');
        const engine = this.detectEngine(origin, path);
        if (!engine) return;

        const traceId = RequestContextService.getTraceId();
        if (typeof request.addHeader === 'function' && !request.getHeader?.('x-request-id')) {
          request.addHeader('x-request-id', traceId);
        }
        this.requestTimings.set(request, {
          start: process.hrtime.bigint(),
          engine,
          endpoint: this.normalizeEndpoint(path),
        });
      });

      diagnostics_channel.subscribe('undici:request:headers', ({ request, response }: any) => {
        const meta = this.requestTimings.get(request);
        if (!meta) return;

        const durationSeconds = Number(process.hrtime.bigint() - meta.start) / 1e9;
        const statusCode = String(response?.statusCode || 200);

        this.metricsService.sandboxHttpDuration.observe(
          { engine: meta.engine, endpoint: meta.endpoint, status_code: statusCode },
          durationSeconds,
        );
      });

      diagnostics_channel.subscribe('undici:request:error', ({ request, error }: any) => {
        const meta = this.requestTimings.get(request);
        if (!meta) return;

        this.metricsService.sandboxFailureTotal.inc({
          engine: meta.engine,
          error_type: 'fetch_error',
        });
        this.logger.error(
          {
            traceId: RequestContextService.getTraceId(),
            engine: meta.engine,
            endpoint: meta.endpoint,
            error: error?.message,
          },
          `${meta.engine.toUpperCase()} fetch execution error`,
        );
      });
    } catch {
      // Fail-open if diagnostics_channel is unavailable
    }
  }

  /**
   * 3. Passively polls Judge0 /about or /queues every 15s if JUDGE0_URL is configured
   */
  private startJudge0QueuePoller(): void {
    const provider = process.env.CODE_EXECUTION_PROVIDER;
    if (provider && provider !== 'judge0') {
      return;
    }

    const judge0BaseUrl = process.env.JUDGE0_URL || process.env.JUDGE0_BASE_URL;
    if (!judge0BaseUrl) return;

    this.pollInterval = setInterval(() => {
      void (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);
          const res = await fetch(`${judge0BaseUrl.replace(/\/$/, '')}/workers`, {
            signal: controller.signal,
            headers: process.env.JUDGE0_AUTH_TOKEN
              ? { 'X-Auth-Token': process.env.JUDGE0_AUTH_TOKEN }
              : {},
          });
          clearTimeout(timer);

          if (res.ok) {
            const workers: any = await res.json();
            const totalQueued = Array.isArray(workers)
              ? workers.reduce((acc, w) => acc + (Number(w.size) || 0), 0)
              : 0;
            this.metricsService.judge0InternalQueueSize.set(totalQueued);
          }
        } catch {
          // Ignore poll blips
        }
      })();
    }, 15_000);
    this.pollInterval.unref();
  }

  detectEngine(hostOrOrigin: string, path: string): 'piston' | 'judge0' | null {
    if (path.includes('/workers')) {
      return null;
    }

    const target = `${hostOrOrigin}${path}`.toLowerCase();
    if (
      target.includes('piston') ||
      target.includes(':2000') ||
      target.includes(':2001') ||
      path.includes('/api/v2/execute')
    ) {
      return 'piston';
    }
    if (
      target.includes('judge0') ||
      target.includes(':2358') ||
      path.includes('base64_encoded') ||
      path.includes('/submissions')
    ) {
      return 'judge0';
    }
    return null;
  }

  normalizeEndpoint(path: string): string {
    const cleanPath = path.split('?')[0];
    return cleanPath
      .replace(/\/submissions\/[a-zA-Z0-9-]+/g, '/submissions/:token')
      .slice(0, 64);
  }

  onModuleDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.isHttpHooked) {
      try {
        if (this.originalHttpRequest) {
          Object.defineProperty(http, 'request', {
            value: this.originalHttpRequest,
            configurable: true,
            writable: true,
          });
        }
        if (this.originalHttpsRequest) {
          Object.defineProperty(https, 'request', {
            value: this.originalHttpsRequest,
            configurable: true,
            writable: true,
          });
        }
      } catch {
        // Fail-open
      }
      this.isHttpHooked = false;
    }
  }
}
