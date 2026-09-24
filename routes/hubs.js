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

// Single hub's details — including which usernames are still waiting on
// approval, but ONLY if the requester is the hub's owner (everyone else
// just sees the public member list, not the pending-requests queue).
router.get("/:id", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  const isOwner = hub.creator === req.user;
  const safeHub = hub.toObject();
  if (!isOwner) delete safeHub.pendingRequests;
  res.json({ ...safeHub, isOwner });
});

router.post("/", async (req, res) => {
  const { name, icon, color, public: isPublic } = req.body;
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
    public: isPublic !== false, // default to public unless explicitly false
  });
  await hub.save();
  res.status(201).json(hub);
});

// Owner can flip public/private any time after creation.
router.patch("/:id/visibility", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  if (hub.creator !== req.user) return res.status(403).json({ error: "Only the hub owner can do that" });
  hub.public = !!req.body.public;
  await hub.save();
  res.json(hub);
});

// Public hub -> joins instantly. Private hub -> sends a join request to the
// owner instead (added to pendingRequests, owner gets a notification).
router.post("/:id/join", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  const self = await User.findOne({ email: req.user });
  if (!self?.username) return res.status(400).json({ error: "Set a username first" });

  if (hub.members.includes(self.username)) {
    return res.json({ status: "already-member", hub });
  }

  if (hub.public) {
    hub.members.push(self.username);
    hub.views += 1;
    await hub.save();
    return res.json({ status: "joined", hub });
  }

  // Private: request instead of instant join
  if (!hub.pendingRequests.includes(self.username)) {
    hub.pendingRequests.push(self.username);
    await hub.save();

    const owner = await User.findOne({ email: hub.creator });
    if (owner) {
      owner.notifications.unshift({
        type: "hub_request",
        text: `${self.username} asked to join your hub "${hub.name}".`,
        from: self.username,
      });
      await owner.save();
      notifyUser(req, owner.email, owner.notifications[0]);
    }
  }
  res.json({ status: "requested", hub });
});

// Owner-only: approve or decline someone's pending join request.
router.post("/:id/requests/:username/approve", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  if (hub.creator !== req.user) return res.status(403).json({ error: "Only the hub owner can do that" });

  const username = req.params.username;
  hub.pendingRequests = hub.pendingRequests.filter((u) => u !== username);
  if (!hub.members.includes(username)) hub.members.push(username);
  await hub.save();

  const requester = await User.findOne({ username });
  if (requester) {
    requester.notifications.unshift({
      type: "hub_accept",
      text: `You were let into "${hub.name}"!`,
      from: null,
    });
    await requester.save();
    notifyUser(req, requester.email, requester.notifications[0]);
  }
  res.json(hub);
});

router.post("/:id/requests/:username/decline", async (req, res) => {
  const hub = await Hub.findById(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  if (hub.creator !== req.user) return res.status(403).json({ error: "Only the hub owner can do that" });

  hub.pendingRequests = hub.pendingRequests.filter((u) => u !== req.params.username);
  await hub.save();
  res.json(hub);
});

module.exports = router;
