import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { getOtpEmailTemplate } from './templates/otp-email.template';
import { OTP_TTL_SECONDS } from '../redis/otp.service';

describe('EmailService & OTP Email Template', () => {
  describe('getOtpEmailTemplate', () => {
    it('generates the correct subject, preheader, HTML, and plain-text body', () => {
      const otp = '731762';
      const template = getOtpEmailTemplate(otp);

      // Subject & Preheader
      expect(template.subject).toBe('Your CodeSkill Login Verification Code');
      expect(template.preheader).toBe(
        'Your secure login code expires in 5 minutes.',
      );

      // Branding
      expect(template.html).toContain('CodeSkill by Chandigarh University');
      expect(template.html).toContain(
        'Department of Skill Development &amp; Lab',
      );
      expect(template.html).toContain(
        'CODING | ASSESSMENT | SKILL DEVELOPMENT',
      );
      expect(template.html).toContain(
        'https://codeskill.novaserve.cloud/email/cu-logo-email.png',
      );
      expect(template.html).toContain(
        'https://codeskill.novaserve.cloud/email/codeskill-mark.png',
      );
      expect(template.html).toContain('alt="Chandigarh University"');
      expect(template.html).toContain('alt="CodeSkill"');

      // Content
      expect(template.html).toContain('Verify Your Identity');
      expect(template.html).toContain('Hello,');
      expect(template.html).toContain(
        'Use the verification code below to securely complete your login.',
      );
      expect(template.html).toContain('YOUR VERIFICATION CODE');
      expect(template.html).toContain('731762');
      expect(template.html).toContain('Expires in 5 minutes');
      expect(template.html).toContain(
        'For your security, never share this code with anyone.',
      );
      expect(template.html).toContain("Didn't request this code?");
      expect(template.html).toContain(
        'anyone claiming to represent CodeSkill or Chandigarh University support.',
      );
      expect(template.html).toContain(
        'Standardized examination portal and algorithmic skill-building platform',
      );
      expect(template.html).toContain(
        '>https://codeskill.novaserve.cloud/</a>',
      );
      expect(template.html).toContain(
        'This is an automated authentication email. Please do not reply to this message.',
      );
      expect(template.html).toContain(
        '&copy; CodeSkill by Chandigarh University. All rights reserved.',
      );

      // Table-based layout, preheader, email-safety
      expect(template.html).toContain('role="presentation"');
      expect(template.html).toContain('display: none; max-height: 0px;');
      expect(template.html).not.toMatch(/<script|<svg|javascript:/i);

      // Plain-Text assertions
      expect(template.text).toContain('CodeSkill by Chandigarh University');
      expect(template.text).toContain('Department of Skill Development & Lab');
      expect(template.text).toContain('YOUR VERIFICATION CODE: 731762');
      expect(template.text).toContain('Expires in 5 minutes');
      expect(template.text).toContain(
        'For your security, never share this code with anyone.',
      );
      expect(template.text).toContain('https://codeskill.novaserve.cloud/');
      expect(template.text).toContain('Please do not reply to this message.');
    });

    it('derives the displayed expiry from the backend OTP TTL', () => {
      expect(OTP_TTL_SECONDS).toBe(300);
      const template = getOtpEmailTemplate('123456');
      expect(template.html).toContain(
        `Expires in ${OTP_TTL_SECONDS / 60} minutes`,
      );
    });

    it('supports an overridable asset base URL for previews', () => {
      const template = getOtpEmailTemplate('123456', {
        assetBaseUrl: 'http://localhost:8765/',
      });
      expect(template.html).toContain(
        'http://localhost:8765/email/cu-logo-email.png',
      );
    });

    it('safely escapes special characters in the OTP code to prevent HTML injection', () => {
      const template = getOtpEmailTemplate('<script>alert("1")</script>');
      expect(template.html).not.toContain('<script>');
      expect(template.html).toContain('&lt;script&gt;');
    });
  });

  describe('EmailService.sendOTPEmail', () => {
    let configService: ConfigService;

    beforeEach(() => {
      configService = {
        get: jest.fn((key: string) => {
          if (key === 'aws.sesSender')
            return 'noreply@codeskill.novaserve.cloud';
          if (key === 'aws.region') return 'ap-south-1';
          return null;
        }),
      } as unknown as ConfigService;
    });

    it('bypasses actual SES in mock mode and logs mock message', async () => {
      const service = new EmailService(configService);
      const result = await service.sendOTPEmail('student@cuchd.in', '123456');

      expect(result).toHaveProperty('MessageId');
      expect(result.MessageId).toMatch(/^mock-message-id-/);
    });

    it('constructs correct SES SendEmailCommand parameters when invoked', async () => {
      const mockSend = jest.fn().mockResolvedValue({ MessageId: 'ses-12345' });
      const service = new EmailService(configService);
      (service as any).isMock = false;
      (service as any).sesClient = { send: mockSend };

      const result = await service.sendOTPEmail('user@example.com', '654321');

      expect(result.MessageId).toBe('ses-12345');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandArg = mockSend.mock.calls[0][0];
      const params = commandArg.input;

      expect(params.Destination.ToAddresses).toEqual(['user@example.com']);
      expect(params.Source).toBe('noreply@codeskill.novaserve.cloud');
      expect(params.Message.Subject.Data).toBe(
        'Your CodeSkill Login Verification Code',
      );
      expect(params.Message.Body.Html.Data).toContain('654321');
      expect(params.Message.Body.Text.Data).toContain('654321');
    });
  });
});
