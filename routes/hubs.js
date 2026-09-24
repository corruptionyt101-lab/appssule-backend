const express = require("express");
const router = express.Router();
const Hub = require("../database/hubmodel");
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

function notifyUser(req, targetEmail, payload) {
  const io = req.app.get("io");
  if (io) io.to("user:" + targetEmail).emit("notification", payload);
}

// List all hubs. Each hub's Mongo _id doubles as its chat roomId —
// the frontend just does socket.emit('join room', hub._id) to open its chat.
router.get("/", async (req, res) => {
  const hubs = await Hub.find({}).sort({ createdAt: -1 });
  res.json(hubs);
});

router.post("/", async (req, res) => {
  const { name, icon, color, isPrivate } = req.body;
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
    isPrivate: !!isPrivate,
  });
  await hub.save();
  res.status(201).json(hub);
});

// Owner can flip a hub between public/private later
router.patch("/:id/privacy", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  if (hub.creator !== req.user) return res.status(403).json({ error: "Only the hub owner can change this" });
  hub.isPrivate = !!req.body.isPrivate;
  await hub.save();
  res.json(hub);
});

// Public hubs: join immediately. Private hubs: this is blocked — use /request instead.
router.post("/:id/join", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  const self = await User.findOne({ email: req.user });
  if (!self?.username) return res.status(400).json({ error: "Set a username first" });

  if (hub.isPrivate && !hub.members.includes(self.username)) {
    return res.status(403).json({ error: "This hub is private — request an invite instead.", isPrivate: true });
  }

  if (!hub.members.includes(self.username)) {
    hub.members.push(self.username);
    hub.views += 1;
    await hub.save();
  }
  res.json(hub);
});

// Request to join a private hub — notifies the owner, who approves/declines.
router.post("/:id/request", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  const self = await User.findOne({ email: req.user });
  if (!self?.username) return res.status(400).json({ error: "Set a username first" });

  if (hub.members.includes(self.username)) return res.json({ status: "already a member" });
  if (hub.pendingRequests.includes(self.username)) return res.json({ status: "already requested" });

  hub.pendingRequests.push(self.username);
  await hub.save();

  const owner = await User.findOne({ email: hub.creator });
  if (owner) {
    owner.notifications.unshift({
      type: "hub_request",
      text: `${self.username} wants to join your hub "${hub.name}".`,
      from: self.username,
    });
    await owner.save();
    notifyUser(req, owner.email, owner.notifications[0]);
  }

  res.json({ status: "requested" });
});

router.post("/:id/approve", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  if (hub.creator !== req.user) return res.status(403).json({ error: "Only the hub owner can approve requests" });

  const { username } = req.body;
  if (!username || !hub.pendingRequests.includes(username)) {
    return res.status(400).json({ error: "No pending request from that user" });
  }

  hub.pendingRequests = hub.pendingRequests.filter((u) => u !== username);
  if (!hub.members.includes(username)) hub.members.push(username);
  await hub.save();

  const requester = await User.findOne({ username });
  if (requester) {
    requester.notifications.unshift({
      type: "hub_accept",
      text: `You were let into "${hub.name}".`,
      from: null,
    });
    await requester.save();
    notifyUser(req, requester.email, requester.notifications[0]);
  }

  res.json(hub);
});

router.post("/:id/decline", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  if (hub.creator !== req.user) return res.status(403).json({ error: "Only the hub owner can decline requests" });

  const { username } = req.body;
  hub.pendingRequests = hub.pendingRequests.filter((u) => u !== username);
  await hub.save();
  res.json(hub);
});

// Member list for the "who's in this hub" panel — basic public fields only.
router.get("/:id/members", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  const members = await User.find({ username: { $in: hub.members } }).select("username image rank");

  let pending = [];
  if (hub.creator === req.user && hub.pendingRequests.length > 0) {
    pending = await User.find({ username: { $in: hub.pendingRequests } }).select("username image rank");
  }

  res.json({
    members,
    pending,
    isOwner: hub.creator === req.user,
    creator: hub.creator,
  });
});

module.exports = router;
