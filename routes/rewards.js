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
  const cutoff = new Date(now - COOLDOWN_MS);
  const nextStreak = last && elapsed <= GRACE_MS ? self.streak + 1 : 1;

  // Atomic: only succeeds if lastClaimedAt is still null/old at the moment of
  // the write. Two near-simultaneous requests can no longer both pass — the
  // second one's filter no longer matches once the first has updated.
  const updated = await User.findOneAndUpdate(
    {
      email: req.user,
      $or: [{ lastClaimedAt: null }, { lastClaimedAt: { $lte: cutoff } }],
    },
    {
      $inc: { coins: 50 },
      $set: { streak: nextStreak, lastClaimedAt: new Date(now) },
    },
    { new: true }
  );

  if (!updated) {
    return res.status(429).json({
      error: "Reward already claimed today",
      msRemaining: Math.max(0, COOLDOWN_MS - elapsed),
    });
  }

  res.json({ coins: updated.coins, streak: updated.streak, lastClaimedAt: updated.lastClaimedAt });
});

module.exports = router;
