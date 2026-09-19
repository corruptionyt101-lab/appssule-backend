const jwt = require("jsonwebtoken");
const bannedIps = require("../database/bannedips.js");
const Users = require("../database/usermodel.js");
const authenticate = async (req, res, next) => {
    const banned = new bannedIps({
    ip: req.ip,
    banned:false
  })
  await banned.save()
    const token = req.cookies?.auth;
    if (!token){
       return res.status(401).json({error: "Unauthorized"});
    }
        jwt.verify(token, process.env.JWT, async(err, decoded) => {
            if (err) {
                return res.status(401).json({error: "Unauthorized"});
                
            }
            req.user = decoded.email;
            req.token = token;
            req.isAdmin = [...JSON.parse(process.env.ADMINS)].includes(req.user);
            const user = await Users.findOne({email:req.user});
            if(user?.banned){
                console.log("User is banned: ", user.email);
                const reason = user.bannedReason
                return res.status(403).json({ bannedReason: reason || "No reason given" })
            }
                
            return next();
        })
}
module.exports = authenticate;