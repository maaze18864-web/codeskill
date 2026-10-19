import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { Redis } from 'ioredis';

const mockRedisInstance = {
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => mockRedisInstance);
  (MockRedis as any).Redis = MockRedis;
  (MockRedis as any).Cluster = jest.fn().mockImplementation(() => mockRedisInstance);
  return {
    __esModule: true,
    default: MockRedis,
    Redis: MockRedis,
    Cluster: (MockRedis as any).Cluster,
  };
});

describe('RedisService (ISSUE-RES-001)', () => {
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'redis.host') return '127.0.0.1';
        if (key === 'redis.port') return 6379;
        if (key === 'redis.password') return 'secret';
        return undefined;
      }),
    };
  });

  it('configures continuous exponential backoff retryStrategy that never returns null', () => {
    new RedisService(mockConfigService as ConfigService);
    expect(Redis).toHaveBeenCalled();
    const passedOptions = (Redis as unknown as jest.Mock).mock.calls[0][0];
    expect(typeof passedOptions.retryStrategy).toBe('function');

    // Test retryStrategy for various retry counts — must NEVER return null
    for (let times = 1; times <= 50; times++) {
      const delay = passedOptions.retryStrategy(times);
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThanOrEqual(50);
      expect(delay).toBeLessThanOrEqual(3200);
    }
  });

  it('successfully sets and gets cached values', async () => {
    const service = new RedisService(mockConfigService as ConfigService);
    mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ score: 100 }));

    const result = await service.get<{ score: number }>('test-key');
    expect(result).toEqual({ score: 100 });
    expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');

    mockRedisInstance.set.mockResolvedValueOnce('OK');
    await service.set('test-key', { score: 100 }, 60);
    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify({ score: 100 }),
      'EX',
      60,
    );
  });
});
