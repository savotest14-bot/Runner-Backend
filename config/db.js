const mongoose = require("mongoose");
const User = require("../models/user");
const Role = require("../models/role");
const template = require("../models/template");
const Plan = require("../models/plan");
const { PERMISSIONS } = require("../constants/permissions");
const ContractTemplate = require("../models/contractTemplate");

const connectDBAndSeed = async () => {
  try {
    const conn = await mongoose.connect(process.env.CONNECTION_STRING);

    console.log(
      "Database connected:",
      conn.connection.host,
      conn.connection.name
    );


    const roleCount = await Role.countDocuments();

    if (!roleCount) {
      console.log("Seeding roles...");

      await Role.insertMany([
        {
          name: "superAdmin",
          scope: "platform",
          permissions: Object.values(PERMISSIONS),
        },
        {
          name: "company_admin",
          scope: "company",
          permissions: [
            PERMISSIONS.CREATE_GROUP,
            PERMISSIONS.UPDATE_GROUP,
            PERMISSIONS.VIEW_GROUP,

            PERMISSIONS.CREATE_USER,
            PERMISSIONS.UPDATE_USER,
            PERMISSIONS.VIEW_USER,
            PERMISSIONS.DELETE_USER,

            PERMISSIONS.VIEW_COMPANY,
            PERMISSIONS.UPDATE_COMPANY,

            PERMISSIONS.VIEW_FINANCE,
            PERMISSIONS.VIEW_INVOICES,

            PERMISSIONS.CREATE_CONTRACT,
            PERMISSIONS.UPDATE_CONTRACT,
            PERMISSIONS.VIEW_CONTRACTS,
            PERMISSIONS.DELETE_CONTRACT,

            PERMISSIONS.VIEW_PROPERTIES,
            PERMISSIONS.VIEW_TASKS,
            PERMISSIONS.VIEW_PLAN,
            PERMISSIONS.PURCHASE_PLAN,
          ],
        },
        {
          name: "group_admin",
          scope: "group",
          permissions: [
            PERMISSIONS.CREATE_USER,
            PERMISSIONS.UPDATE_USER,
            PERMISSIONS.VIEW_USER,

            PERMISSIONS.VIEW_GROUP,
          ],
        },
        {
          name: "finance_manager",
          scope: "company",
          permissions: [
            PERMISSIONS.VIEW_FINANCE,
            PERMISSIONS.MANAGE_PAYMENTS,
            PERMISSIONS.VIEW_INVOICES,
          ],
        },
        {
          name: "employee",
          scope: "self",
          permissions: [
            PERMISSIONS.VIEW_SELF,
            PERMISSIONS.UPDATE_SELF,
          ],
        },
      ]);

      console.log("Roles seeded successfully");
    }

    /* -------------------------- SUPER ADMIN ---------------------------- */

    const superAdminRole = await Role.findOne({
      name: { $regex: "^superAdmin$", $options: "i" }
    });
    const superAdminExists = await User.countDocuments({
      role: superAdminRole._id,
    });

    if (!superAdminExists) {
      console.log("Creating Super Admin...");

      await User.create({
        firstName: "Runner",
        lastName: "Admin",
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        phone: "+1234567890",

        role: superAdminRole._id,
        company: null, // IMPORTANT
      });
    }

    /* ----------------------------- TEMPLATES ---------------------------- */

    const templates = await template.countDocuments();

    if (!templates) {
      await template.insertMany([
        {
          templateEvent: "otp-verify",
          subject: "NZL OTP Verification",
          mailVariables: "%otp% %fullName%",
          htmlBody: `
  <body style="margin: 0; padding: 0; font-family: 'Poppins', Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
      <tr>
        <td align="center" style="padding: 20px;">
          <table width="600" border="0" cellspacing="0" cellpadding="0"
            style="border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            
            <tr>
              <td
                style="background-color: #3760FA; padding: 30px; text-align: center; color: white; font-size: 28px; font-weight: 600;">
                NZL Account Verification
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td
                style="padding: 40px 30px; text-align: left; font-size: 16px; line-height: 1.6; color: #333333;">
                <h2 style="margin-top: 0; color: #3760FA;">Hello, %fullName%!</h2>

                <p>Please use the following verification code to complete your action. The code is valid for
                  <strong>10 minutes</strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 10px 30px; text-align: center;">
                <div
                  style="background-color: #eaf6f5; padding: 20px; font-size: 32px; font-weight: 700; letter-spacing: 5px; text-align: center; border-radius: 8px; color: #3760FA;">
                  %otp%
                </div>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 30px 30px 40px 30px; text-align: left; font-size: 16px; line-height: 1.6; color: #333333;">
                <p style="margin-bottom: 0;">For your security, please do not share this code with anyone.
                  If you did not request this code, you can safely ignore this email.</p>
              </td>
            </tr>

            <tr>
              <td
                style="background-color: #263238; padding: 20px; text-align: center; color: #bbbbbb; font-size: 14px;">
                Copyright © ${new Date().getFullYear()} | NZL. All rights reserved.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  `,
          textBody: `Hello %fullName%, your verification code is %otp%. Please use it within 10 minutes.`,
        },

      ]);
    }

    /*-------------------------------Contract Template-----------------------*/
    const contractTemplates = await ContractTemplate.countDocuments();

    if (!contractTemplates) {

      await ContractTemplate.insertMany([
        {
          templateCode: "template-1",
          templateName: "Light Blue",
          htmlBody: `
        <html>
          <body style="font-family:Arial;background:#f4f8ff">
            <h2 style="color:#3760FA">Contract Agreement</h2>
            <p>Client Name: {{clientName}}</p>
            <p>Contract No: {{contractNumber}}</p>
          </body>
        </html>
      `
        },
        {
          templateCode: "template-2",
          templateName: "Light Pink",
          htmlBody: `
        <html>
          <body style="font-family:Arial;background:#fff0f5">
            <h2 style="color:#d63384">Contract Agreement</h2>
            <p>Client Name: {{clientName}}</p>
            <p>Contract No: {{contractNumber}}</p>
          </body>
        </html>
      `
        },
        {
          templateCode: "template-3",
          templateName: "Purple",
          htmlBody: `
        <html>
          <body style="background:#faf5ff">
            <h2 style="color:#7c3aed">Contract Agreement</h2>
          </body>
        </html>
      `
        },
        {
          templateCode: "template-4",
          templateName: "Dark",
          htmlBody: `
        <html>
          <body style="background:#000;color:#fff">
            <h2>Contract Agreement</h2>
          </body>
        </html>
      `
        },
        {
          templateCode: "template-5",
          templateName: "Green",
          htmlBody: `
        <html>
          <body style="background:#0f766e;color:#fff">
            <h2>Contract Agreement</h2>
          </body>
        </html>
      `
        },
        {
          templateCode: "template-6",
          templateName: "Teal",
          htmlBody: `
        <html>
          <body style="background:#134e4a;color:#fff">
            <h2>Contract Agreement</h2>
          </body>
        </html>
      `
        },
        {
          templateCode: "template-7",
          templateName: "Minimal",
          htmlBody: `
        <html>
          <body style="background:#fff;color:#111">
            <h2>Contract Agreement</h2>
          </body>
        </html>
      `
        }
      ]);

      console.log("7 Contract templates seeded successfully");
    }

    
    /* ------------------------------- PLANS ------------------------------ */

    const plansCount = await Plan.countDocuments();

    if (!plansCount) {
      console.log("Seeding plans...");

      await Plan.insertMany([
        {
          planName: "Basic",
          description: "It is a Basic Plan",
          monthlyFees: 99,
          annualFees: 999,
          planStatus: "active",
          sequence: 1,
          planFeatures: [
            "5 users",
            "Email support",
            "Basic reports"
          ],
        },
        {
          planName: "Premium",
          description: "It is a Premium Plan",
          monthlyFees: 199,
          annualFees: 1999,
          planStatus: "active",
          sequence: 2,
          planFeatures: [
            "5 users",
            "Email support",
            "Basic reports"
          ],
        },
        {
          planName: "Enterprise",
          description: "It is an Enterprise Plan",
          monthlyFees: 299,
          annualFees: 2999,
          planStatus: "active",
          sequence: 3,
          planFeatures: [
            "5 users",
            "Email support",
            "Basic reports"
          ],
        },
      ]);
    }

    console.log("Database seeding completed ✅");
  } catch (err) {
    console.error("Database connection failed ❌", err);
    process.exit(1);
  }


};

module.exports = connectDBAndSeed;