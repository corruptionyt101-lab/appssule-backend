const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const userModel = require("../database/usermodel.js");
const bannedIps = require("../database/bannedips.js");
const chatMessages = require("../database/chatmodel.js");
const authenticate = require("./authenticate.js");
const adminAuthenticate = async (req, res, next) => {
  if (req.isAdmin) return next(); // env-var ADMINS list — always trusted
  try {
    const dbUser = await userModel.findOne({ email: req.user });
    if (dbUser?.admin) return next(); // granted Admin Console access via the console itself
  } catch (err) {
    console.error("Error checking admin flag: ", err);
  }
  return res.status(403).json({ message: "Forbidden: Not an admin" });
};
router.use(authenticate);
router.use(adminAuthenticate);
router.get("/", (req, res) => {
  console.log("Admin opened dashboard: ", req.user);
  res.status(200).json({ message: "Admin authenticated" });
});
router.get("/messages", async(req, res) => {
  try{
    const messages = await chatMessages.find({}).lean();
    return res.status(200).json(messages);
  }catch(err){
    console.error("Error fetching messages: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
})
router.get("/users", async (req, res) => {
  try {
    const users = await userModel.find({}).lean();
    return res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
router.delete("/users/delete", async (req, res) => {
  const usernameToDelete = req.body.userId;

  if (!usernameToDelete) {
    return res.status(400).json({ error: "UserId is required" });
  }
  const userToDelete = await userModel.findOne({ _id: usernameToDelete });
  if (!userToDelete) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    await userToDelete.deleteOne();
    console.log("User deleted successfully by admin: ", userToDelete.email);
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
router.patch("/users/ban", async (req, res) => {
  const userToBan = req.body.userId;
  const bannedMessage = req.body.message || "No reason provided";
  const unBanOrNot = bannedMessage.includes(":unban")
  if (!userToBan) {
    return res.status(400).json({ error: "Id is required" });
  }
  const user = await userModel.findOne({ _id: userToBan });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  try {
    if (unBanOrNot) {
      user.banned = false;
      user.bannedReason = "";
      await user.save();
      console.log("User unbanned successfully by admin: ", user.email);
      return res.status(200).json({ message: "User unbanned successfully" });
    }
    user.banned = true;
    user.bannedReason = bannedMessage;
    await user.save();
    console.log("User banned successfully by admin: ", user.email);
    return res.status(200).json({ message: "User banned successfully" });
  } catch (err) {
    console.error("Error banning user: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
router.post("/users/ipban", async (req, res) => {
  try {
    const userToBan = req.body.userId;
    if (!userToBan) return res.status(400).json({ error: "Id is required" });
    const [bannedMessage, unBanOrNot] = req.body.message.split(":");
    const user = await userModel.findOne({ _id: userToBan });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const isBanned = await bannedIps.findOne({ ip: user.ip });
    // dont forget that i added ts
    if (isBanned) {
      if (unBanOrNot?.toLowerCase() !== "unban")
        return res.status(409).json({ error: "duplicate ip addresses" });
      isBanned.banned = false;
      await isBanned.save();
      return;
    }
    const ipBan = new bannedIps({
      ip: user.ip,
      bannedReason: bannedMessage,
    });
    await ipBan.save();
  } catch (err) {
    console.error("Error ip banning user: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Set a user's cosmetic rank label (Owner, Dev, Mod, Member)
router.patch("/users/rank", async (req, res) => {
  try {
    const { userId, rank } = req.body;
    if (!userId || !rank) {
      return res.status(400).json({ error: "userId and rank are required" });
    }
    const allowed = ["Owner", "Founder", "Admin", "Dev", "Mod", "Member"];
    if (!allowed.includes(rank)) {
      return res.status(400).json({ error: `rank must be one of: ${allowed.join(", ")}` });
    }
    const user = await userModel.findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    user.rank = rank;
    await user.save();
    console.log(`Admin ${req.user} set ${user.email}'s rank to ${rank}`);
    return res.status(200).json({ message: "Rank updated", rank: user.rank });
  } catch (err) {
    console.error("Error setting rank: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Give (or take) coins — no upper bound, this is an admin tool
router.post("/users/gift", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const parsedAmount = Number(amount);
    if (!userId || !Number.isFinite(parsedAmount)) {
      return res.status(400).json({ error: "userId and a numeric amount are required" });
    }
    const user = await userModel.findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    user.coins = (user.coins || 0) + parsedAmount;
    await user.save();
    console.log(`Admin ${req.user} gifted ${parsedAmount} coins to ${user.email}`);
    return res.status(200).json({ message: "Coins updated", coins: user.coins });
  } catch (err) {
    console.error("Error gifting coins: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Grant or revoke Admin Console access on another account
router.patch("/users/grant-admin", async (req, res) => {
  try {
    const { userId, admin } = req.body;
    if (!userId || typeof admin !== "boolean") {
      return res.status(400).json({ error: "userId and a boolean admin flag are required" });
    }
    const user = await userModel.findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    user.admin = admin;
    await user.save();
    console.log(`Admin ${req.user} ${admin ? "granted" : "revoked"} console access for ${user.email}`);
    return res.status(200).json({ message: "Admin access updated", admin: user.admin });
  } catch (err) {
    console.error("Error updating admin access: ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
