// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// const createMultiUpload = ({
//   fields,
//   maxSizeMB = 2,
// }) => {
//   const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//       const field = fields.find(f => f.name === file.fieldname);
//       if (!field) {
//         return cb(new Error("Invalid upload field"));
//       }

//       const uploadPath = `uploads/${field.folder}`;
//       fs.mkdirSync(uploadPath, { recursive: true });
//       cb(null, uploadPath);
//     },

//     filename: (req, file, cb) => {
//       const unique =
//         Date.now() + "-" + Math.round(Math.random() * 1e9);
//       cb(null, unique + path.extname(file.originalname));
//     },
//   });

//   const fileFilter = (req, file, cb) => {
//     const field = fields.find(f => f.name === file.fieldname);

//     if (!field.allowedTypes.includes(file.mimetype)) {
//       return cb(
//         new Error(`Invalid file type for ${file.fieldname}`),
//         false
//       );
//     }

//     cb(null, true);
//   };

//   return multer({
//     storage,
//     fileFilter,
//     limits: { fileSize: maxSizeMB * 1024 * 1024 },
//   }).fields(
//     fields.map(f => ({
//       name: f.name,
//       maxCount: f.maxCount || 1,
//     }))
//   );
// };

// module.exports = createMultiUpload;


const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createMultiUpload = ({ fields, maxSizeMB = 2 }) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const field = fields.find(f => f.name === file.fieldname);
      if (!field) {
        const err = new Error("Invalid upload field");
        err.status = 400;
        return cb(err);
      }

      const uploadPath = path.join("uploads", field.folder);
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  });

  const fileFilter = (req, file, cb) => {
    const field = fields.find(f => f.name === file.fieldname);

    if (!field) {
      const err = new Error(`Unexpected field: ${file.fieldname}`);
      err.status = 400;
      return cb(err, false);
    }

    if (!field.allowedTypes.includes(file.mimetype)) {
      const err = new Error(`Invalid file type for ${file.fieldname}`);
      err.status = 415;
      return cb(err, false);
    }

    cb(null, true);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  }).fields(
    fields.map(f => ({
      name: f.name,
      maxCount: f.maxCount || 1,
    }))
  );

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  };
};

module.exports = createMultiUpload;
