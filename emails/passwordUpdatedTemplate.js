exports.passwordUpdatedTemplate = ({
  fullName,
  email,
  password,
  companyName,
}) => {
  const year = new Date().getFullYear();

  return {
    subject: `Your ${companyName} account password has been updated`,

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Password Updated</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:30px;">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:#3760FA;padding:24px;text-align:center;color:#ffffff;">
              <h1 style="margin:0;font-size:24px;font-weight:600;">
                Password Updated
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;color:#333333;font-size:15px;line-height:1.6;">
              <p style="margin-top:0;">
                Hello <strong>${fullName}</strong>,
              </p>

              <p>
                Your account password has been updated by an administrator.
                Below are your updated login details.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="10" cellspacing="0"
                style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:20px 0;">
                <tr>
                  <td width="35%" style="font-weight:600;">Email</td>
                  <td>${email}</td>
                </tr>
                <tr>
                  <td width="35%" style="font-weight:600;">New Password</td>
                  <td>${password}</td>
                </tr>
              </table>

              <p style="color:#b91c1c;font-weight:600;">
                For security reasons, please log in and change your password immediately.
              </p>

              <p style="margin-top:30px;">
                If you did not request this change, please contact your administrator immediately.
              </p>

              <p style="margin-top:30px;">
                Regards,<br />
                <strong>${companyName} Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;color:#6b7280;text-align:center;padding:16px;font-size:13px;">
              © ${year} ${companyName}. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,

    text: `
Hello ${fullName},

Your account password has been updated by an administrator.

Login details:
Email: ${email}
New Password: ${password}

Please log in and change your password immediately.

If you did not request this change, contact your administrator.

${companyName} Team
© ${year}
    `,
  };
};
