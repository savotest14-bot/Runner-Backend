exports.employeeWelcomeTemplate = ({
  fullName,
  email,
  password,
  companyName,
}) => {
  const year = new Date().getFullYear();

  return {
    subject: `Welcome to ${companyName} – Your Login Details`,

    html: `
      <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f6f8;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:30px;">
              <table width="600" cellpadding="0" cellspacing="0"
                style="background:#ffffff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden;">

                <tr>
                  <td style="background:#3760FA;color:#ffffff;padding:24px;text-align:center;">
                    <h1 style="margin:0;font-size:26px;">
                      Welcome to ${companyName}
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px;color:#333333;font-size:15px;line-height:1.6;">
                    <p>Hello <strong>${fullName}</strong>,</p>

                    <p>
                      We’re excited to have you onboard 🎉  
                      Your employee account has been successfully created.
                    </p>

                    <p><strong>Your login credentials:</strong></p>

                    <table cellpadding="8" cellspacing="0"
                      style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
                      <tr>
                        <td><strong>Email:</strong></td>
                        <td>${email}</td>
                      </tr>
                      <tr>
                        <td><strong>Temporary Password:</strong></td>
                        <td>${password}</td>
                      </tr>
                    </table>

                    <p style="margin-top:20px;">
                      For security reasons, please log in and change your password immediately.
                    </p>

                    <p style="margin-top:30px;">
                      Best regards,<br />
                      <strong>${companyName} Team</strong>
                    </p>
                  </td>
                </tr>

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
    `,

    text: `
Hello ${fullName},

Welcome to ${companyName}!

Your employee account has been created successfully.

Login details:
Email: ${email}
Temporary Password: ${password}

Please log in and change your password immediately.

Best regards,
${companyName} Team
    `,
  };
};
