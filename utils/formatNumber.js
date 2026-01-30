const formatNumber = (prefix, number, pad = 2) => {
  return `${prefix}-${String(number).padStart(pad, "0")}`;
};

module.exports = formatNumber;
