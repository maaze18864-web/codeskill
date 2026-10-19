/**
 * Kept in a dependency-free module so email templates can display the real
 * validity period without importing OtpService (which imports EmailService).
 */
export const OTP_TTL_SECONDS = 300;
