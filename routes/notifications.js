const express = require("express");
const router = express.Router();
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

router.get("/", async (req, res) => {
  const self = await User.findOne({ email: req.user });
  if (!self) return res.status(404).json({ error: "User not found" });
  res.json(self.notifications);
});

router.post("/read-all", async (req, res) => {
  const self = await User.findOne({ email: req.user });
  if (!self) return res.status(404).json({ error: "User not found" });
  self.notifications.forEach((n) => (n.read = true));
  await self.save();
  res.json({ status: "ok" });
});

router.post("/:id/read", async (req, res) => {
  const self = await User.findOne({ email: req.user });
  if (!self) return res.status(404).json({ error: "User not found" });
  const notif = self.notifications.id(req.params.id);
  if (notif) notif.read = true;
  await self.save();
  res.json({ status: "ok" });
});

module.exports = router;
