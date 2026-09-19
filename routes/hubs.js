const express = require("express");
const router = express.Router();
const Hub = require("../database/hubmodel");
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

// List all hubs. Each hub's Mongo _id doubles as its chat roomId —
// the frontend just does socket.emit('join room', hub._id) to open its chat.
router.get("/", async (req, res) => {
  const hubs = await Hub.find({}).sort({ createdAt: -1 });
  res.json(hubs);
});

router.post("/", async (req, res) => {
  const { name, icon, color } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Hub name required" });
  }
  const self = await User.findOne({ email: req.user });
  const hub = new Hub({
    name: name.trim(),
    icon: icon || "fa-gamepad",
    color: color || "#0088ff",
    creator: req.user,
    members: self?.username ? [self.username] : [],
  });
  await hub.save();
  res.status(201).json(hub);
});

router.post("/:id/join", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  const self = await User.findOne({ email: req.user });
  if (self?.username && !hub.members.includes(self.username)) {
    hub.members.push(self.username);
    hub.views += 1;
    await hub.save();
  }
  res.json(hub);
});

module.exports = router;
