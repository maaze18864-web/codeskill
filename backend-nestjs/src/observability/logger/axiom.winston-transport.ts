import Transport from 'winston-transport';
import { Axiom } from '@axiomhq/js';
import { RequestContextService } from '../context/request-context.service';

export interface AxiomWinstonOptions extends Transport.TransportStreamOptions {
  token: string;
  dataset: string;
  edgeUrl?: string;
  service?: string;
  environment?: string;
}

export class AxiomWinstonTransport extends Transport {
  private readonly axiom: Axiom;
  private readonly dataset: string;
  private readonly serviceName: string;
  private readonly environment: string;

  constructor(opts: AxiomWinstonOptions) {
    super(opts);
    this.dataset = opts.dataset;
    this.serviceName = opts.service || process.env.SERVICE_NAME || 'codeskill-backend';
    this.environment = opts.environment || process.env.NODE_ENV || 'production';

    this.axiom = new Axiom({
      token: opts.token,
      edgeUrl: opts.edgeUrl || process.env.AXIOM_EDGE_URL || 'https://eu-central-1.aws.edge.axiom.co',
      onError: () => {
        // Fail-open: background batch ingestion errors must never disrupt application execution
      },
    });
  }

  log(info: any, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    try {
      const { level, message, timestamp, stack, context, ...meta } = info;

      // Extract traceId and userId from RequestContextService if available
      const traceId = meta.traceId || RequestContextService.getTraceId();
      const userId = meta.userId || RequestContextService.getUserId();

      // PII Redaction
      const sanitizedMeta = this.sanitizeMeta(meta);

      const event = {
        _time: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        level,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        service: this.serviceName,
        environment: this.environment,
        context: context || 'Application',
        traceId,
        ...(userId ? { userId } : {}),
        ...(stack ? { stack } : {}),
        ...sanitizedMeta,
      };

      const ingestResult = this.axiom.ingest(this.dataset, [event]) as unknown;
      if (ingestResult && typeof (ingestResult as Promise<unknown>).catch === 'function') {
        (ingestResult as Promise<unknown>).catch(() => {
          // Fail-open: network drops or Axiom ingestion errors must never disrupt application execution
        });
      }
    } catch {
      // Fail-open: logging failures must never disrupt application execution
    }

    callback();
  }

  private sanitizeMeta(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveKeys = new Set([
      'password',
      'temporarypassword',
      'token',
      'accesstoken',
      'refreshtoken',
      'secret',
      'mfasecret',
      'authorization',
      'cookie',
    ]);

    const result: any = Array.isArray(obj) ? [] : {};
    for (const [key, val] of Object.entries(obj)) {
      if (sensitiveKeys.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else if (val && typeof val === 'object') {
        result[key] = this.sanitizeMeta(val);
      } else {
        result[key] = val;
      }
    }
    return result;
  }
}
