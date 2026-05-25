"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpEmailTemplate = void 0;
const otpEmailTemplate = (otp) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MediSync Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1d4ed8;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">MediSync</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Medical Management System</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 48px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Verify your email address</h2>
              <p style="margin:0 0 32px;color:#64748b;font-size:15px;line-height:1.6;">
                Use the verification code below to complete your registration.
                This code expires in <strong>10 minutes</strong>.
              </p>
              <div style="background:#f1f5f9;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
                <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#1d4ed8;">${otp}</span>
              </div>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">
                If you did not request this code, you can safely ignore this email.
              </p>
              <p style="margin:0;color:#94a3b8;font-size:12px;">Do not share this code with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 48px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; ${new Date().getFullYear()} MediSync. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
exports.otpEmailTemplate = otpEmailTemplate;
//# sourceMappingURL=otp.template.js.map