const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createUpload = ({
  folder,
  fieldName, 
  allowedTypes = [],
  maxSizeMB = 5,
  multiple = false,
  maxCount = 1,
}) => {
  if (!fieldName) {
    throw new Error("fieldName is required for upload middleware");
  }

  fs.mkdirSync(`uploads/${folder}`, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `uploads/${folder}`);
    },
    filename: (req, file, cb) => {
      const unique =
        Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  });

 const fileFilter = (req, file, cb) => {
  if (allowedTypes.length && !allowedTypes.includes(file.mimetype)) {
    const error = new Error(`Invalid file type: ${file.mimetype}`);
    error.status = 415; 
    error.code = "INVALID_FILE_TYPE";

    return cb(error, false);
  }

  cb(null, true);
};


  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
  });

  return multiple
    ? upload.array(fieldName, maxCount)
    : upload.single(fieldName);
};

module.exports = createUpload;
