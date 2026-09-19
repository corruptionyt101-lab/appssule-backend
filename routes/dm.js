const express = require("express");
const router = express.Router();
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

// Deterministic room id for a DM between two users — sorted so both sides
// compute the same value. Frontend calls this, then socket.emit('join room', roomId)
// to reuse the exact same chat pipe that hubs already use.
router.get("/room/:username", async (req, res) => {
  const self = await User.findOne({ email: req.user });
  const target = await User.findOne({ username: req.params.username });
  if (!self || !target) return res.status(404).json({ error: "User not found" });
  const roomId = "dm_" + [self.email, target.email].sort().join("_");
  res.json({ roomId });
});

module.exports = router;
