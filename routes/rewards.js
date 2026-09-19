const express = require("express");
const router = express.Router();
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const GRACE_MS = 48 * 60 * 60 * 1000; // miss more than this and the streak resets

router.get("/status", async (req, res) => {
  const self = await User.findOne({ email: req.user });
  if (!self) return res.status(404).json({ error: "User not found" });
  const last = self.lastClaimedAt ? self.lastClaimedAt.getTime() : 0;
  const elapsed = Date.now() - last;
  res.json({
    canClaim: elapsed >= COOLDOWN_MS,
    msRemaining: Math.max(0, COOLDOWN_MS - elapsed),
    streak: self.streak,
    coins: self.coins,
  });
});

router.post("/claim", async (req, res) => {
  const self = await User.findOne({ email: req.user });
  if (!self) return res.status(404).json({ error: "User not found" });

  const now = Date.now();
  const last = self.lastClaimedAt ? self.lastClaimedAt.getTime() : 0;
  const elapsed = now - last;

  if (elapsed < COOLDOWN_MS) {
    return res.status(429).json({
      error: "Reward already claimed today",
      msRemaining: COOLDOWN_MS - elapsed,
    });
  }

  self.streak = last && elapsed <= GRACE_MS ? self.streak + 1 : 1;
  self.coins += 50;
  self.lastClaimedAt = new Date(now);
  await self.save();

  res.json({ coins: self.coins, streak: self.streak, lastClaimedAt: self.lastClaimedAt });
});

module.exports = router;
