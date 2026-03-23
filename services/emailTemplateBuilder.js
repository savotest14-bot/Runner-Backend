const EmailTemplate = require("../models/contractTemplate");
const Task = require("../models/task");

async function buildContractEmail({
  contract,
  client,
  company,
  templateCode,
  themeName,
  frontendUrl
}) {

  const BACKEND_URL = process.env.BACKEND_URL || "";

  const template = await EmailTemplate.findOne({
    templateCode,
    isActive: true
  });

  if (!template) throw new Error("Email template not found");

  let html = template.html;

  const theme = template.themes[themeName];
  if (!theme) throw new Error("Theme not found");

  // ================= APPLY THEME =================
  Object.keys(theme).forEach(key => {
    html = html.replaceAll(`{{${key}}}`, theme[key]);
  });

  // ================= FETCH TASKS =================
  const populatedTasks = await Task.find({
    _id: { $in: contract.tasks }
  });

  // ================= TASK ROW BUILDER =================
  let taskRows = "";

  populatedTasks.forEach((task, index) => {

    const price = Number(task.taskPrice || 0);

    taskRows += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px;">${index + 1}</td>
        <td>${task.taskName || ""}</td>
        <td>${task.taskDuration || ""} ${task.taskDurationUnit || ""}</td>
        <td>₹ ${price.toLocaleString()}</td>
        <td>₹ ${price.toLocaleString()}</td>
      </tr>
    `;
  });

  html = html.replaceAll("{{TASK_ROWS}}", taskRows || "");

  // ================= BUILD FULL CLIENT ADDRESS =================
  const clientAddress = [
    client.addressLine1,
    client.addressLine2,
    client.city,
    client.state,
    client.country,
    client.pincode
  ].filter(Boolean).join(", ");

  // ================= COMPANY LOGO FULL URL =================
  const companyLogoFullUrl =
    company?.logo
      ? `${BACKEND_URL}${company.logo}`
      : "";

  // ================= VARIABLES =================
  html = html
    .replaceAll("{{CLIENT_NAME}}", client.name || "")
    .replaceAll("{{CLIENT_ADDRESS}}", clientAddress)

    .replaceAll("{{COMPANY_NAME}}", company.companyName || "")
    .replaceAll("{{COMPANY_TAGLINE}}", company.tagline || "")

    // ⭐ FULL URL LOGO FIX
    .replaceAll("{{COMPANY_LOGO}}", companyLogoFullUrl)

    .replaceAll("{{COMPANY_ADDRESS}}", company.address || "")
    .replaceAll(
      "{{COMPANY_PHONE}}",
      `${company.phoneCode || ""} ${company.phoneNumber || ""}`
    )

    .replaceAll("{{INVOICE_NO}}", contract.invoiceNumber || "")
    .replaceAll("{{REFERENCE_NO}}", contract.referenceNumber || "")
    .replaceAll(
      "{{TOTAL}}",
      `₹ ${Number(contract.totalCost || 0).toLocaleString()}`
    );

  // ================= ACCEPT / REJECT LINKS =================
  html = html
    .replaceAll(
      "{{ACCEPT_URL}}",
      `${frontendUrl}/api/contract/respond?contractId=${contract._id}&action=accept`
    )
    .replaceAll(
      "{{REJECT_URL}}",
      `${frontendUrl}/api/contract/respond?contractId=${contract._id}&action=reject`
    );

  return html;
}

module.exports = buildContractEmail;
