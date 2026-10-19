import { OtpService } from './otp.service';

describe('OtpService and Email Integration', () => {
  let redisClientMock: any;
  let redisServiceMock: any;
  let emailServiceMock: any;
  let configServiceMock: any;
  let otpService: OtpService;

  beforeEach(() => {
    redisClientMock = {
      set: jest.fn().mockResolvedValue('OK'),
      multi: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 'OK'],
          [null, 1],
        ]),
      }),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue(1),
    };

    redisServiceMock = {
      getClient: jest.fn().mockReturnValue(redisClientMock),
    };

    emailServiceMock = {
      sendOTPEmail: jest
        .fn()
        .mockResolvedValue({ MessageId: 'test-ses-msg-id' }),
    };

    configServiceMock = {
      get: jest
        .fn()
        .mockReturnValue('super-secret-jwt-key-for-testing-purposes-12345'),
      getOrThrow: jest.fn().mockReturnValue({
        secret: 'super-secret-jwt-key-for-testing-purposes-12345',
      }),
    };

    otpService = new OtpService(
      redisServiceMock,
      emailServiceMock,
      configServiceMock,
    );
  });

  it('generates a 6-digit code, stores it with 5-minute TTL, and triggers sendOTPEmail', async () => {
    const email = 'student@cuchd.in';
    const result = await otpService.sendOTP(email, 'login');

    expect(result).toEqual({ success: true, message: 'OTP sent successfully' });

    // Cooldown check
    expect(redisClientMock.set).toHaveBeenCalledWith(
      expect.stringContaining('cooldown'),
      '1',
      'EX',
      60,
      'NX',
    );

    // Persist OTP with 300s TTL (5 minutes)
    const multiMock = redisClientMock.multi();
    expect(multiMock.set).toHaveBeenCalledWith(
      'otp:{student@cuchd.in}:login',
      expect.any(String),
      'EX',
      300,
    );

    // Email service receives normalized email and 6-digit OTP
    expect(emailServiceMock.sendOTPEmail).toHaveBeenCalledTimes(1);
    const [sentEmail, sentOtp] = emailServiceMock.sendOTPEmail.mock.calls[0];
    expect(sentEmail).toBe('student@cuchd.in');
    expect(sentOtp).toMatch(/^\d{6}$/);
  });
});
