import { Controller, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';

@ApiTags('Observability & Metrics')
@SkipThrottle()
@Controller(['metrics', 'api/metrics'])
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Prometheus metrics exposition endpoint' })
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const scrapeToken = process.env.METRICS_SCRAPE_TOKEN;
    const authHeader = req.headers.authorization;
    const clientIp = req.ip || req.socket?.remoteAddress || '';

    const normalizedIp = clientIp.replace(/^::ffff:/, '');
    const isInternalIp =
      normalizedIp === '127.0.0.1' ||
      normalizedIp === '::1' ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalizedIp) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(normalizedIp) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalizedIp);

    if (scrapeToken) {
      if (authHeader !== `Bearer ${scrapeToken}` && !isInternalIp) {
        throw new UnauthorizedException('Metrics access restricted to authorized scrapers');
      }
    } else if (!isInternalIp) {
      throw new UnauthorizedException('Metrics access restricted to internal VPC');
    }

    res.setHeader('Content-Type', this.metricsService.registry.contentType);
    res.send(await this.metricsService.getMetricsSnapshot());
  }
}
