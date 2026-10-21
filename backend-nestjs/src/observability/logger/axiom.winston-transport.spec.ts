import { AxiomWinstonTransport } from './axiom.winston-transport';
import { Axiom } from '@axiomhq/js';

jest.mock('@axiomhq/js');

describe('AxiomWinstonTransport', () => {
  let transport: AxiomWinstonTransport;
  let mockIngest: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIngest = jest.fn().mockResolvedValue({});
    (Axiom as jest.MockedClass<typeof Axiom>).mockImplementation(() => {
      return {
        ingest: mockIngest,
      } as unknown as Axiom;
    });

    transport = new AxiomWinstonTransport({
      token: 'test-token',
      dataset: 'test-dataset',
      service: 'test-service',
      environment: 'test',
    });
  });

  it('should ingest sanitized logs successfully', (done) => {
    const info = {
      level: 'info',
      message: 'User logged in',
      password: 'super-secret-password',
      token: 'jwt-token-xyz',
      safeData: 'public-data',
    };

    transport.log(info, () => {
      expect(mockIngest).toHaveBeenCalledTimes(1);
      const [dataset, events] = mockIngest.mock.calls[0];
      expect(dataset).toBe('test-dataset');
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('User logged in');
      expect(events[0].password).toBe('[REDACTED]');
      expect(events[0].token).toBe('[REDACTED]');
      expect(events[0].safeData).toBe('public-data');
      done();
    });
  });

  it('should catch and suppress async ingestion rejections without crashing', (done) => {
    mockIngest.mockRejectedValue(new Error('Axiom network connection timeout'));

    const info = {
      level: 'error',
      message: 'Something went wrong',
    };

    expect(() => {
      transport.log(info, () => {
        expect(mockIngest).toHaveBeenCalledTimes(1);
        // Process next tick to ensure promise catch handler runs
        process.nextTick(() => {
          done();
        });
      });
    }).not.toThrow();
  });
});
