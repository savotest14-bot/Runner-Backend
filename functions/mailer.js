const nodemailer = require("nodemailer");
const MailTemplate = require("../models/template");

const sendMail = async (templateName, mailVariable, email) => {
  try {
    const template = await MailTemplate.findOne({
      templateEvent: templateName,
      isDeleted: false,
      active: true,
    }).lean();

    if (!template) {
      throw new Error(
        `Mail template not found or inactive: ${templateName}`
      );
    }

    let subject = template.subject || "";
    let html = template.htmlBody || "";
    let text = template.textBody || "";

    for (const key in mailVariable) {
      if (Object.prototype.hasOwnProperty.call(mailVariable, key)) {
        const value = mailVariable[key];
        if (typeof value === "string") {
          subject = subject.split(key).join(value);
          html = html.split(key).join(value);
          text = text.split(key).join(value);
        }
      }
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.PASSWORD,
      },
    });

    const mailOptions = {
      from: `"No Reply" <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject,
      text,
      html,
    };

    await transporter.sendMail(mailOptions);

    return { type: "success", message: "Mail successfully sent" };
  } catch (error) {
    console.error("sendMail error:", error.message);
    throw new Error(error.message || "Failed to send mail");
  }
};

module.exports = { sendMail };

