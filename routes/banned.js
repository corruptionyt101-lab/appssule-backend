const bannedIps = require("../database/bannedips.js");
const bannedAuthenticate = async (req, res, next) => {
  const ipBanned = await bannedIps.findOne({ ip: req.ip });
  if (ipBanned && ipBanned.banned) {
    const reasonn = ipBanned.bannedReason
    console.log(reasonn);
    return res.status(403).json({ bannedReason: reasonn || "No reason given" });
  }
  next();
};
module.exports = bannedAuthenticate;
