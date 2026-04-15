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
            PERMISSIONS.VIEW_TEMPLATES,
            PERMISSIONS.VIEW_PLAN,
            PERMISSIONS.PURCHASE_PLAN,
            PERMISSIONS.MANAGE_EMPLOYEES,
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
        {
          name: "runner_employee",
          scope: "platform",
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

     async function storeInvoiceTemplate() {
  const html = `<div style="font-family: Arial; background:#f3f4f6; padding:30px;">
  <div style="max-width:800px; margin:auto; background:white; border-radius:12px; padding:25px;">

   <div style="{{BACKGROUND_HEADER}}; padding:20px; border-radius:10px; {{HEADER_TEXT}}">
  <table width="100%">
    <tr>
      <td>
        <table>
          <tr>
            <td style="vertical-align:middle;">
              <img 
                src="{{COMPANY_LOGO}}" 
                alt="Company Logo"
                style="height:45px; max-width:150px; object-fit:contain; margin-right:10px;"
              />
            </td>
            <td style="vertical-align:middle;">
              <h2 style="margin:0;">{{COMPANY_NAME}}</h2>
              <small>{{COMPANY_TAGLINE}}</small>
            </td>
          </tr>
        </table>
      </td>

      <td align="right">
        <b>{{COMPANY_ADDRESS}}</b><br/>
        {{COMPANY_PHONE}}
      </td>
    </tr>
  </table>
</div>

    <table width="100%" style="margin-top:25px;">
      <tr>
        <td width="50%">
          <b>Client Detail</b><br/>
          {{CLIENT_NAME}}<br/>
          {{CLIENT_ADDRESS}}
        </td>
        <td width="50%" align="right">
          <b>Invoice:</b> {{INVOICE_NO}}<br/>
          <b>Reference:</b> {{REFERENCE_NO}}
        </td>
      </tr>
    </table>

    <table width="100%" style="margin-top:25px; border-collapse: collapse;">
      <tr style="{{TABLE_HEADER_BG}}">
        <th style="padding:10px;">#</th>
        <th>Task</th>
        <th>Time</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>

      {{TASK_ROWS}}

    </table>

    <div style="margin-top:20px;" align="right">
      <h3 style="{{TOTAL_COLOR}}">Total: {{TOTAL}}</h3>
    </div>

    <!-- ✅ ACCEPT / REJECT BUTTONS -->
    <div style="margin-top:35px; text-align:center;">

      <p style="margin-bottom:15px; font-size:14px;">
        Please confirm this contract.
      </p>

      <a href="{{ACCEPT_URL}}" 
         style="background:#22c55e;
                color:white;
                padding:14px 28px;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
                display:inline-block;
                margin-right:10px;">
        ✅ Accept Contract
      </a>

      <a href="{{REJECT_URL}}" 
         style="background:#ef4444;
                color:white;
                padding:14px 28px;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
                display:inline-block;">
        ❌ Reject Contract
      </a>

    </div>

  </div>
</div>
`;

  const themes = {
    blue: {
      BACKGROUND_HEADER: "background:#e0ecff",
      HEADER_TEXT: "color:#1e40af",
      TABLE_HEADER_BG: "background:#dbeafe",
      TOTAL_COLOR: "color:#1e40af",
    },
    green: {
      BACKGROUND_HEADER: "background:#dcfce7",
      HEADER_TEXT: "color:#166534",
      TABLE_HEADER_BG: "background:#bbf7d0",
      TOTAL_COLOR: "color:#166534",
    },
    purple: {
      BACKGROUND_HEADER: "background:#ede9fe",
      HEADER_TEXT: "color:#6d28d9",
      TABLE_HEADER_BG: "background:#ddd6fe",
      TOTAL_COLOR: "color:#6d28d9",
    },
    red: {
      BACKGROUND_HEADER: "background:#fee2e2",
      HEADER_TEXT: "color:#b91c1c",
      TABLE_HEADER_BG: "background:#fecaca",
      TOTAL_COLOR: "color:#b91c1c",
    },
    orange: {
      BACKGROUND_HEADER: "background:#ffedd5",
      HEADER_TEXT: "color:#c2410c",
      TABLE_HEADER_BG: "background:#fed7aa",
      TOTAL_COLOR: "color:#c2410c",
    },
    teal: {
      BACKGROUND_HEADER: "background:#ccfbf1",
      HEADER_TEXT: "color:#115e59",
      TABLE_HEADER_BG: "background:#99f6e4",
      TOTAL_COLOR: "color:#115e59",
    },
    dark: {
      BACKGROUND_HEADER: "background:#111827",
      HEADER_TEXT: "color:#ffffff",
      TABLE_HEADER_BG: "background:#1f2937; color:white",
      TOTAL_COLOR: "color:#111827",
    }
  };

  await ContractTemplate.create({
    name: "Invoice Template",
    templateCode: "invoice_v1",
    subject: "Invoice from {{COMPANY}}",
    html,
    themes, 
    isActive: true,
  });

  console.log("✅ Invoice template stored successfully");
}
storeInvoiceTemplate();
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
          employeeLimit: 2,
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
          employeeLimit: 25,
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
          employeeLimit: 50,
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