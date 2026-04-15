const createMultiUpload = require("./uploadMultiFactory");

exports.uploadEmployeeImages = createMultiUpload({
  maxSizeMB: 2,
  fields: [
    {
      name: "profileImage",
      folder: "profile-images",
      allowedTypes: ["image/png", "image/jpg", "image/jpeg"],
      maxCount: 1,
    },
    {
      name: "idImages",
      folder: "id-images",
      allowedTypes: ["image/png", "image/jpeg", "image/jpg", "application/pdf"],
      maxCount: 5,
    },
    {
      name: "aadhaarImages",
      folder: "aadhaar-images",
      allowedTypes: ["image/png", "image/jpeg", "image/jpg", "application/pdf"],
      maxCount: 5,
    },
  ],
});

exports.uploadContractFiles = createMultiUpload({
  maxSizeMB: 5,
  fields: [
    {
      name: "clientLogo",
      folder: "client-logos",
      allowedTypes: ["image/png", "image/jpeg", "image/jpg"],
      maxCount: 1,
    },
    {
      name: "additionalDocuments",
      folder: "contract-documents",
      allowedTypes: [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "application/pdf",
      ],
      maxCount: 10,
    },
  ],
});
