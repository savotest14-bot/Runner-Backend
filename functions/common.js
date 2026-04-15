const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

module.exports.humanize = (str) => {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("-")
    )
    .join(" ");
};

module.exports.generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

module.exports.hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(otp.toString(), salt);
};

module.exports.verifyOTPAndPassword = async (plainOTP, hashedOTP) => {
  return await bcrypt.compare(plainOTP.toString().trim(), hashedOTP);
};

module.exports.paginate = (query) => {
  return new Promise(async function (resolve, reject) {
    try {

      let { page = 1, limit = 5 } = query;
      page = Math.max(1, parseInt(page));
      limit = Math.max(1, parseInt(limit));

      return resolve({ status: 200, data: { page, limit } })

    } catch (error) {
      return reject(error)
    }
  });
};

module.exports.deleteFileIfExists = (filePath) => {
  if (!filePath) return;

  const absolutePath = path.join(process.cwd(), filePath);

  fs.access(absolutePath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(absolutePath, (err) => {
        if (err) console.error("File delete error:", err);
      });
    }
  });
};

module.exports.getFileUrl = (req, filePath) => {
  if (!filePath) return null;

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/${filePath.replace(/\\/g, "/")}`;
};