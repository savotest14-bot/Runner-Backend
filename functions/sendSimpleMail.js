const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.PASSWORD,
  },
});

transporter.verify()
  .then(() => console.log("✅ Mail server ready"))
  .catch(err => console.error("❌ Mail server error:", err));

exports.sendSimpleMail = async ({ to, subject, html, text }) => {
  try {

    const info = await transporter.sendMail({
      from: `"No Reply" <${process.env.MAIL_USERNAME}>`,
      to,
      subject,
      html,
      text,
    });

    console.log("📧 Mail sent:", info.messageId);

    return info;

  } catch (error) {
    console.error("❌ Mail send failed:", error);
    throw error;
  }
};
