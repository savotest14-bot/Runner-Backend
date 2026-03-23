const Contract = require("../models/contract");
const { getFileUrl, deleteFileIfExists } = require("../functions/common");
const EmailTemplate = require("../models/contractTemplate");
const Company = require("../models/company");
// Clients

exports.getAllClientsForCompanyAdmin = async (req, res) => {
  try {
    const user = req.user;

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can access clients",
      });
    }

    const contracts = await Contract.find({
      company: user.company,
      isDeleted: false,
    })
      .populate("property")
      .populate("client")
      .select("property client")
      .lean();

    if (!contracts.length) {
      return res.status(200).json({
        success: true,
        totalClients: 0,
        totalTasks: 0,
        data: [],
      });
    }

    const clientMap = new Map();

    contracts.forEach(({ _id: contractId, client, property }) => {
      if (!client || client.isDeleted) return;

      const clientId = client._id.toString();

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          _id: client._id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          city: client.city,
          country: client.country,
          clientLogo: client.clientLogo,
          createdAt: client.createdAt,

          // Aggregated fields
          propertyNames: [],
          contractIds: [],
          totalTasks: 0, // ✅ TASK COUNT
        });
      }

      const existingClient = clientMap.get(clientId);

      // Add unique property names
      if (
        property?.propertyName &&
        !existingClient.propertyNames.includes(property.propertyName)
      ) {
        existingClient.propertyNames.push(property.propertyName);
      }

      // Track contracts (tasks)
      existingClient.contractIds.push(contractId);
      existingClient.totalTasks += 1; // ✅ INCREMENT TASK COUNT
    });

    const result = Array.from(clientMap.values()).map((client) => {
      if (client.clientLogo) {
        client.clientLogo = getFileUrl(req, client.clientLogo);
      }

      // ❌ Optional: remove internal ids if frontend doesn't need them
      delete client.contractIds;

      return client;
    });

    // ✅ Overall task count (all clients)
    const totalTasks = result.reduce(
      (sum, client) => sum + client.totalTasks,
      0,
    );

    return res.status(200).json({
      success: true,
      totalClients: result.length,
      totalTasks,
      data: result,
    });
  } catch (error) {
    console.error("Get all clients error:", error);
    return res.status(500).json({
      message: "Failed to fetch clients",
    });
  }
};

// Property

exports.getAllPropertiesForCompanyAdmin = async (req, res) => {
  try {
    const user = req.user;

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can access properties",
      });
    }

    const contracts = await Contract.find({
      company: user.company,
      isDeleted: false,
    })
      .populate("property")
      .populate("client")
      .populate("company", "companyName")
      .select("property client company")
      .lean();

    if (!contracts.length) {
      return res.status(200).json({
        success: true,
        totalProperties: 0,
        totalTasks: 0,
        data: [],
      });
    }

    const propertyMap = new Map();

    contracts.forEach(({ _id: contractId, property, client, company }) => {
      if (!property || property.isDeleted) return;
      if (!client || client.isDeleted) return;

      const propertyId = property._id.toString();

      if (!propertyMap.has(propertyId)) {
        propertyMap.set(propertyId, {
          _id: property._id,
          propertyName: property.propertyName,
          propertyType: property.propertyType,
          description: property.description,
          sizeSqm: property.sizeSqm,
          noOfResidents: property.noOfResidents,
          specialFeatureEndDate: property.specialFeatureEndDate,

          client: {
            _id: client._id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            city: client.city,
            country: client.country,
            clientLogo: client.clientLogo,
          },

          company: company
            ? {
                _id: company._id,
                companyName: company.companyName,
              }
            : null,

          contractIds: [],
          totalTasks: 0, // ✅ TASK COUNT PER PROPERTY
          createdAt: property.createdAt,
        });
      }

      const existingProperty = propertyMap.get(propertyId);

      existingProperty.contractIds.push(contractId);
      existingProperty.totalTasks += 1; // ✅ INCREMENT TASK COUNT
    });

    const result = Array.from(propertyMap.values()).map((property) => {
      if (property.client?.clientLogo) {
        property.client.clientLogo = getFileUrl(
          req,
          property.client.clientLogo,
        );
      }

      // ❌ Optional: remove internal ids
      delete property.contractIds;

      return property;
    });

    // ✅ OVERALL TASK COUNT (ALL PROPERTIES)
    const totalTasks = result.reduce(
      (sum, property) => sum + property.totalTasks,
      0,
    );

    return res.status(200).json({
      success: true,
      totalProperties: result.length,
      totalTasks,
      data: result,
    });
  } catch (error) {
    console.error("Get all properties error:", error);
    return res.status(500).json({
      message: "Failed to fetch properties",
    });
  }
};


exports.getTemplatesForAdmin = async (req, res) => {
  try {
    const templates = await EmailTemplate.find({ isActive: true });

    const result = templates.map((template) => {
      const previews = Object.entries(template.themes).map(
        ([themeName, themeColors]) => {
          let previewHtml = template.html;

          Object.entries(themeColors).forEach(([key, value]) => {
            previewHtml = previewHtml.replaceAll(`{{${key}}}`, value);
          });

          const dummyData = {
            COMPANY_ADDRESS: "Zurich, Switzerland",
            COMPANY_PHONE: "+41 123 456 789",
            CLIENT_NAME: "John Doe",
            CLIENT_ADDRESS: "Client Address",
            INVOICE_NO: "INV-001",
            REFERENCE_NO: "REF-2026",
            TASK_ROWS: `
              <tr>
                <td style="padding:10px;">1</td>
                <td>Consultation</td>
                <td>5h</td>
                <td>$100</td>
                <td>$500</td>
              </tr>
            `,
            TOTAL: "$500"
          };

          Object.entries(dummyData).forEach(([key, value]) => {
            previewHtml = previewHtml.replaceAll(`{{${key}}}`, value);
          });

          return {
            theme: themeName,
            previewHtml
          };
        }
      );

      return {
        templateId: template._id,
        name: template.name,
        templateCode: template.templateCode,
        subject: template.subject,
        previews
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load templates" });
  }
};


exports.updateCompanyLogo = async (req, res) => {
  try {
    const companyId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ message: "No logo file uploaded" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Company not found" });
    }

    if (company.logo) {
      deleteFileIfExists(company.logo)
    }

    company.logo = `/uploads/company-logos/${req.file.filename}`;
    await company.save();

    return res.status(200).json({
      message: "Company logo updated successfully",
      logo: company.logo,
    });
  } catch (error) {
    console.error("Error updating company logo:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: "Failed to update company logo" });
  }
};