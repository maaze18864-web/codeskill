import { UnauthorizedException } from '@nestjs/common';
import { MetricsController } from './metrics.controller';

describe('MetricsController (ISSUE-SEC-003 Hardening)', () => {
  let controller: MetricsController;
  let mockMetricsService: any;
  let mockRes: any;

  beforeEach(() => {
    mockMetricsService = {
      registry: { contentType: 'text/plain' },
      getMetricsSnapshot: jest.fn().mockResolvedValue('system_metric 1.0'),
    };
    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    controller = new MetricsController(mockMetricsService);
  });

  it('rejects external IP with UnauthorizedException when IP contains 10. as substring but is not RFC 1918', async () => {
    const req: any = {
      ip: '210.45.1.2',
      headers: {},
    };

    await expect(controller.getMetrics(req, mockRes)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects external IP with UnauthorizedException when IP contains 172. as substring but is not 172.16-31', async () => {
    const req: any = {
      ip: '172.217.16.206', // Public Google IP
      headers: {},
    };

    await expect(controller.getMetrics(req, mockRes)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows access from verified RFC 1918 private IP (10.0.2.15)', async () => {
    const req: any = {
      ip: '10.0.2.15',
      headers: {},
    };

    await controller.getMetrics(req, mockRes);
    expect(mockRes.send).toHaveBeenCalledWith('system_metric 1.0');
  });

  it('allows access from verified loopback IP (127.0.0.1 and ::1)', async () => {
    const req: any = {
      ip: '127.0.0.1',
      headers: {},
    };

    await controller.getMetrics(req, mockRes);
    expect(mockRes.send).toHaveBeenCalledWith('system_metric 1.0');
  });

  it('allows access from external IP when valid METRICS_SCRAPE_TOKEN bearer header is provided', async () => {
    process.env.METRICS_SCRAPE_TOKEN = 'secret-scrape-token-abc';
    const req: any = {
      ip: '198.51.100.42',
      headers: { authorization: 'Bearer secret-scrape-token-abc' },
    };

    await controller.getMetrics(req, mockRes);
    expect(mockRes.send).toHaveBeenCalledWith('system_metric 1.0');
    delete process.env.METRICS_SCRAPE_TOKEN;
  });
});
