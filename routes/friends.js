const express = require("express");
const router = express.Router();
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

async function getSelf(req) {
  return User.findOne({ email: req.user });
}

function notifyUser(req, targetEmail, payload) {
  const io = req.app.get("io");
  if (io) io.to("user:" + targetEmail).emit("notification", payload);
}

router.get("/", async (req, res) => {
  const self = await getSelf(req);
  if (!self) return res.status(404).json({ error: "User not found" });
  res.json({
    friends: self.friends,
    incomingRequests: self.incomingRequests,
    outgoingRequests: self.outgoingRequests,
  });
});

// Search all usernames for the "Find Friends" tab. Excludes yourself, returns
// only what's safe to show publicly.
router.get("/search", async (req, res) => {
  const self = await getSelf(req);
  const q = (req.query.q || "").trim();
  const filter = {
    username: { $exists: true, $ne: null, ...(q ? { $regex: q, $options: "i" } : {}) },
  };
  const users = await User.find(filter)
    .select("username color image")
    .limit(50);
  res.json(users.filter((u) => !self || u.username !== self.username));
});

router.post("/request/:username", async (req, res) => {
  const self = await getSelf(req);
  const target = await User.findOne({ username: req.params.username });
  if (!self || !self.username) return res.status(400).json({ error: "Set a username first" });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (self.username === target.username) return res.status(400).json({ error: "Can't friend yourself" });
  if (self.friends.includes(target.username)) return res.status(409).json({ error: "Already friends" });

  // They already sent us a request — accept it instead of duplicating.
  if (self.incomingRequests.includes(target.username)) {
    self.incomingRequests = self.incomingRequests.filter((u) => u !== target.username);
    target.outgoingRequests = target.outgoingRequests.filter((u) => u !== self.username);
    self.friends.push(target.username);
    target.friends.push(self.username);
    target.notifications.unshift({
      type: "friend_accept",
      text: `${self.username} accepted your friend request.`,
      from: self.username,
    });
    await self.save();
    await target.save();
    notifyUser(req, target.email, target.notifications[0]);
    return res.json({ status: "friends" });
  }

  if (self.outgoingRequests.includes(target.username)) {
    return res.json({ status: "outgoing" }); // already sent, no-op
  }

  self.outgoingRequests.push(target.username);
  target.incomingRequests.push(self.username);
  target.notifications.unshift({
    type: "friend_request",
    text: `${self.username} sent you a friend request.`,
    from: self.username,
  });
  await self.save();
  await target.save();
  notifyUser(req, target.email, target.notifications[0]);
  res.json({ status: "outgoing" });
});

router.post("/accept/:username", async (req, res) => {
  const self = await getSelf(req);
  const target = await User.findOne({ username: req.params.username });
  if (!self) return res.status(404).json({ error: "User not found" });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (!self.incomingRequests.includes(target.username)) {
    return res.status(400).json({ error: "No pending request from that user" });
  }

  self.incomingRequests = self.incomingRequests.filter((u) => u !== target.username);
  target.outgoingRequests = target.outgoingRequests.filter((u) => u !== self.username);
  if (!self.friends.includes(target.username)) self.friends.push(target.username);
  if (!target.friends.includes(self.username)) target.friends.push(self.username);
  target.notifications.unshift({
    type: "friend_accept",
    text: `${self.username} accepted your friend request.`,
    from: self.username,
  });
  await self.save();
  await target.save();
  notifyUser(req, target.email, target.notifications[0]);
  res.json({ status: "friends" });
});

router.post("/decline/:username", async (req, res) => {
  const self = await getSelf(req);
  if (!self) return res.status(404).json({ error: "User not found" });
  self.incomingRequests = self.incomingRequests.filter((u) => u !== req.params.username);
  await self.save();

  const target = await User.findOne({ username: req.params.username });
  if (target) {
    target.outgoingRequests = target.outgoingRequests.filter((u) => u !== self.username);
    await target.save();
  }
  res.json({ status: "declined" });
});

router.post("/cancel/:username", async (req, res) => {
  const self = await getSelf(req);
  if (!self) return res.status(404).json({ error: "User not found" });
  self.outgoingRequests = self.outgoingRequests.filter((u) => u !== req.params.username);
  await self.save();

  const target = await User.findOne({ username: req.params.username });
  if (target) {
    target.incomingRequests = target.incomingRequests.filter((u) => u !== self.username);
    await target.save();
  }
  res.json({ status: "cancelled" });
});

router.delete("/:username", async (req, res) => {
  const self = await getSelf(req);
  if (!self) return res.status(404).json({ error: "User not found" });
  self.friends = self.friends.filter((u) => u !== req.params.username);
  await self.save();

  const target = await User.findOne({ username: req.params.username });
  if (target) {
    target.friends = target.friends.filter((u) => u !== self.username);
    await target.save();
  }
  res.json({ status: "removed" });
});

module.exports = router;
