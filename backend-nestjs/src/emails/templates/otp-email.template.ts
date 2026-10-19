/**
 * Transactional OTP email for CodeSkill by Chandigarh University.
 *
 * Email-client safe: table layout, inline CSS, no JavaScript, no SVG/web
 * fonts. Logos are hosted PNGs (see frontend-v2/public/email/) with alt text and
 * live-text brand lines so the message stays readable with images blocked.
 */
import { OTP_TTL_SECONDS } from '../../redis/otp.constants';

export interface OtpEmailContent {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export interface OtpEmailOptions {
  /** Origin that serves /email/*.png. Overridable for local previews. */
  assetBaseUrl?: string;
}

const SITE_URL = 'https://codeskill.novaserve.cloud/';
const DEFAULT_ASSET_BASE_URL = 'https://codeskill.novaserve.cloud';

const BRAND_NAME = 'CodeSkill by Chandigarh University';
const DEPARTMENT = 'Department of Skill Development & Lab';
const TAGLINE = 'CODING | ASSESSMENT | SKILL DEVELOPMENT';
const DESCRIPTION =
  'Standardized examination portal and algorithmic skill-building platform engineered for developers, students, and technical evaluations.';

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO =
  "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace";

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} seconds`;
}

export function getOtpEmailTemplate(
  otp: string,
  options: OtpEmailOptions = {},
): OtpEmailContent {
  const safeOtp = escapeHtml(otp.trim());
  const assetBase = (options.assetBaseUrl ?? DEFAULT_ASSET_BASE_URL).replace(
    /\/+$/,
    '',
  );
  const expiry = formatExpiry(OTP_TTL_SECONDS);
  const subject = 'Your CodeSkill Login Verification Code';
  const preheader = `Your secure login code expires in ${expiry}.`;

  const brandHtml = escapeHtml(BRAND_NAME);
  const deptHtml = escapeHtml(DEPARTMENT);
  const descHtml = escapeHtml(DESCRIPTION);

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .outer-pad { padding: 0 !important; }
      .email-card { border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .header-pad { padding: 22px 20px 20px 20px !important; }
      .content-padding { padding: 28px 20px 28px 20px !important; }
      .footer-pad { padding: 24px 20px !important; }
      .cu-logo { width: 120px !important; height: auto !important; }
      .otp-display { font-size: 32px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #eef1f6; color: #334155; font-family: ${FONT}; -webkit-font-smoothing: antialiased;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #eef1f6; opacity: 0;">
    ${escapeHtml(preheader)}
    &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eef1f6;">
    <tr>
      <td class="outer-pad" align="center" style="padding: 32px 16px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container email-card" style="max-width: 600px; background-color: #ffffff; border: 1px solid #dbe2ec; border-radius: 14px; overflow: hidden; margin: 0 auto;">

          <!-- Header -->
          <tr>
            <td class="header-pad" bgcolor="#0B2A66" style="background-color: #0B2A66; background-image: linear-gradient(135deg, #0A1A3F 0%, #0E3A8A 100%); padding: 26px 36px 22px 36px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding: 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 8px;">
                      <tr>
                        <td style="padding: 6px 10px;">
                          <img class="cu-logo" src="${assetBase}/email/cu-logo-email.png" width="130" alt="Chandigarh University" style="display: block; width: 130px; height: auto; font-family: ${FONT}; font-size: 12px; font-weight: 700; color: #0f172a;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" width="1" style="padding: 0 16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr><td width="1" height="44" bgcolor="#3b5ea8" style="width: 1px; height: 44px; background-color: #3b5ea8; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td valign="middle" style="padding: 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle" style="padding: 0;">
                          <img src="${assetBase}/email/codeskill-mark.png" width="36" height="40" alt="CodeSkill" style="display: block; width: 36px; height: 40px; font-family: ${FONT}; font-size: 14px; font-weight: 800; color: #ffffff;" />
                        </td>
                        <td valign="middle" style="padding: 0 0 0 10px;">
                          <div style="font-family: ${FONT}; font-size: 22px; line-height: 26px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff;">Code<span style="color: #60a5fa;">Skill</span></div>
                          <div style="font-family: ${FONT}; font-size: 12px; line-height: 16px; font-weight: 600; color: #dbe7ff;">by Chandigarh University</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding: 16px 0 0 0; font-family: ${FONT}; font-size: 10px; line-height: 14px; font-weight: 700; letter-spacing: 1.6px; color: #93c5fd;">
                    ${escapeHtml(TAGLINE)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0 0 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: #cbd5e1;">
                    ${deptHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="content-padding" style="padding: 36px 36px 32px 36px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 16px 0;">
                <tr>
                  <td bgcolor="#eaf1ff" style="background-color: #eaf1ff; border-radius: 6px; padding: 6px 12px; font-family: ${FONT}; font-size: 11px; line-height: 14px; font-weight: 700; letter-spacing: 1.5px; color: #1d4ed8;">SECURE AUTHENTICATION</td>
                </tr>
              </table>
              <h1 style="margin: 0 0 18px 0; font-family: ${FONT}; font-size: 26px; line-height: 32px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                Verify Your Identity
              </h1>
              <p style="margin: 0 0 12px 0; font-family: ${FONT}; font-size: 15px; line-height: 24px; color: #334155;">
                Hello,
              </p>
              <p style="margin: 0 0 26px 0; font-family: ${FONT}; font-size: 15px; line-height: 24px; color: #334155;">
                We received a request to sign in to your CodeSkill account. Use the verification code below to securely complete your login.
              </p>

              <!-- OTP panel -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#eaf2ff" style="background-color: #eaf2ff; border: 1px solid #cfe0fb; border-radius: 12px; margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="padding: 24px 16px 22px 16px;">
                    <div style="font-family: ${FONT}; font-size: 11px; line-height: 16px; font-weight: 700; letter-spacing: 2px; color: #1d4ed8; text-transform: uppercase; margin: 0 0 12px 0;">
                      YOUR VERIFICATION CODE
                    </div>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                      <tr>
                        <td align="center" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #dbe7fb; border-radius: 10px; padding: 12px 28px;">
                          <div class="otp-display" style="font-family: ${MONO}; font-size: 40px; line-height: 48px; font-weight: 800; letter-spacing: 8px; color: #0f1f4d; -webkit-user-select: all; user-select: all;">${safeOtp}</div>
                        </td>
                      </tr>
                    </table>
                    <div style="margin: 14px 0 0 0; font-family: ${FONT}; font-size: 14px; line-height: 20px; font-weight: 700; color: #1d4ed8;">
                      Expires in ${expiry}
                    </div>
                    <div style="margin: 4px 0 0 0; font-family: ${FONT}; font-size: 13px; line-height: 19px; color: #64748b;">
                      For your security, never share this code with anyone.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#fffbeb" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;">
                <tr>
                  <td valign="top" width="28" style="padding: 16px 0 16px 16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" valign="middle" width="24" height="24" bgcolor="#f59e0b" style="width: 24px; height: 24px; background-color: #f59e0b; border-radius: 12px; font-family: ${FONT}; font-size: 14px; line-height: 24px; font-weight: 800; color: #ffffff;">!</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top" style="padding: 15px 18px 16px 12px;">
                    <p style="margin: 0 0 4px 0; font-family: ${FONT}; font-size: 14px; line-height: 20px; font-weight: 700; color: #92400e;">
                      Didn't request this code?
                    </p>
                    <p style="margin: 0; font-family: ${FONT}; font-size: 13px; line-height: 20px; color: #78350f;">
                      You can safely ignore this email. Never share your verification code with anyone, including anyone claiming to represent CodeSkill or Chandigarh University support.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer-pad" bgcolor="#ffffff" style="background-color: #ffffff; border-top: 1px solid #e2e8f0; padding: 26px 36px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 14px 0;">
                <tr>
                  <td valign="middle" style="padding: 0;">
                    <img src="${assetBase}/email/cu-logo-email.png" width="104" alt="Chandigarh University" style="display: block; width: 104px; height: auto; font-family: ${FONT}; font-size: 12px; font-weight: 700; color: #0f172a;" />
                  </td>
                  <td valign="middle" width="1" style="padding: 0 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr><td width="1" height="32" bgcolor="#cbd5e1" style="width: 1px; height: 32px; background-color: #cbd5e1; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td valign="middle" style="padding: 0;">
                    <img src="${assetBase}/email/codeskill-mark.png" width="26" height="29" alt="CodeSkill" style="display: block; width: 26px; height: 29px; font-family: ${FONT}; font-size: 12px; font-weight: 800; color: #0f172a;" />
                  </td>
                  <td valign="middle" style="padding: 0 0 0 8px; font-family: ${FONT}; font-size: 16px; line-height: 18px; font-weight: 800; letter-spacing: -0.2px; color: #0f172a;">
                    Code<span style="color: #2563EB;">Skill</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 2px 0; font-family: ${FONT}; font-size: 14px; line-height: 20px; font-weight: 700; color: #0f172a;">
                ${brandHtml}
              </p>
              <p style="margin: 0 0 10px 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: #475569;">
                ${deptHtml}
              </p>
              <p style="margin: 0 0 16px 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: #64748b;">
                ${descHtml}
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 8px 0;">
                <tr>
                  <td align="center" bgcolor="#2563EB" style="background-color: #2563EB; border-radius: 999px;">
                    <a href="${SITE_URL}" target="_blank" style="display: inline-block; padding: 11px 24px; font-family: ${FONT}; font-size: 14px; line-height: 18px; font-weight: 700; color: #ffffff; text-decoration: none;">Visit CodeSkill &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 18px 0; font-family: ${FONT}; font-size: 13px; line-height: 20px;">
                <a href="${SITE_URL}" target="_blank" style="color: #2563EB; font-weight: 600; text-decoration: underline;">${SITE_URL}</a>
              </p>
              <p style="margin: 0 0 4px 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: #94a3b8;">
                This is an automated authentication email. Please do not reply to this message.
              </p>
              <p style="margin: 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: #94a3b8;">
                &copy; ${brandHtml}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${BRAND_NAME}
${DEPARTMENT}
${TAGLINE}

VERIFY YOUR IDENTITY

Hello,

We received a request to sign in to your CodeSkill account. Use the verification code below to securely complete your login.

YOUR VERIFICATION CODE: ${otp.trim()}
Expires in ${expiry}

For your security, never share this code with anyone.

Didn't request this code?
You can safely ignore this email. Never share your verification code with anyone, including anyone claiming to represent CodeSkill or Chandigarh University support.

--------------------------------------------------
${BRAND_NAME}
${DEPARTMENT}
${DESCRIPTION}

${SITE_URL}

This is an automated authentication email. Please do not reply to this message.
© ${BRAND_NAME}. All rights reserved.
`;

  return { subject, preheader, html, text };
}
