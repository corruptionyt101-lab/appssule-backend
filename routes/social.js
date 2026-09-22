const express = require("express");
const router = express.Router();
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

// Search usernames by prefix/substring — powers a real "Find Friends" / DM
// search instead of guessing exact usernames. Only returns public-safe fields.
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const self = await User.findOne({ email: req.user });

  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex chars
  const matches = await User.find({
    username: { $regex: safe, $options: "i" },
  })
    .select("username image")
    .limit(15)
    .lean();

  res.json(
    matches
      .filter((u) => u.username && u.username !== self?.username)
      .map((u) => ({ username: u.username, image: u.image }))
  );
});

// Public-safe profile lookup for any username — no coins/email/streak exposed,
// since those are private to the account owner.
router.get("/profile/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username }).select(
    "username bio rep image"
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ username: user.username, bio: user.bio, rep: user.rep, image: user.image });
});

// Update your own bio (already stored on the schema, just had no save path)
router.post("/bio", async (req, res) => {
  const bio = String(req.body.bio || "").slice(0, 100);
  const self = await User.findOne({ email: req.user });
  if (!self) return res.status(404).json({ error: "User not found" });
  self.bio = bio;
  await self.save();
  res.json({ bio: self.bio });
});

// Gift Caps to another real user — atomic-ish via sequential saves, with
// balance re-checked right before deducting.
router.post("/gift/:username", async (req, res) => {
  const amount = parseInt(req.body.amount, 10);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

  const self = await User.findOne({ email: req.user });
  const target = await User.findOne({ username: req.params.username });
  if (!self || !target) return res.status(404).json({ error: "User not found" });
  if (self.username === target.username) return res.status(400).json({ error: "Can't gift yourself" });
  if (self.coins < amount) return res.status(400).json({ error: "Not enough Caps" });

  self.coins -= amount;
  target.coins += amount;
  target.rep = (target.rep || 0) + Math.max(1, Math.floor(amount / 10));
  target.notifications.unshift({
    type: "gift",
    text: `${self.username} gifted you ${amount} Caps!`,
    from: self.username,
  });

  await self.save();
  await target.save();

  const io = req.app.get("io");
  if (io) io.to("user:" + target.email).emit("notification", target.notifications[0]);

  res.json({ coins: self.coins });
});

module.exports = router;
