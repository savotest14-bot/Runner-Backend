const createUpload = require("./uploadFactory");

exports.uploadLicenseDocs = createUpload({
  folder: "licenses",
  fieldName: "licenseDocuments",
  allowedTypes: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ],
  maxSizeMB: 5,
  multiple: true,
  maxCount: 5,
});

exports.uploadProfileImage = createUpload({
  folder: "profile-images",
  fieldName: "profileImage", 
  allowedTypes: ["image/png", "image/jpeg", "image/jpg"],
  maxSizeMB: 2,
});

exports.uploadCompanyLogo = createUpload({
  folder: "company-logos",
  fieldName: "companyLogo", 
  allowedTypes: ["image/png", "image/jpeg", "image/jpg"],
  maxSizeMB: 2,
});

exports.uploadGroupLogo = createUpload({
  folder: "group-logos",
  fieldName: "groupLogo", 
  allowedTypes: ["image/png", "image/jpeg", "image/jpg"],
  maxSizeMB: 2,
});
