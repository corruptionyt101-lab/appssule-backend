const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // "friend_request" | "friend_accept" | "gift"
    text: { type: String, required: true },
    from: { type: String, default: null }, // the other user's username
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  // Display identity used by the frontend (chat, friends, profile). Email stays
  // the login/JWT identity so nothing in auth.js or bin/www has to change.
  username: {
    type: String,
    trim: true,
    unique: true,
    sparse: true, // lets pre-existing accounts without a username coexist
  },
  password: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: "lightgray",
  },
  image: {
    type: String,
    default: "none",
  },
  ip: {
    type: String,
    default: "none",
  },
  banned: {
    type: Boolean,
    default: false,
  },
  bannedReason: {
    type: String,
    default: "No reason specified.",
  },
  previousAccounts: {
    type: [String],
    default: [],
  },

  // ---- Game / profile fields ----
  bio: { type: String, default: "", maxlength: 100 },
  rep: { type: Number, default: 0 },
  coins: { type: Number, default: 100 },
  streak: { type: Number, default: 0 },
  lastClaimedAt: { type: Date, default: null },

  // ---- Friends (all stored as the OTHER user's username) ----
  friends: { type: [String], default: [] },
  incomingRequests: { type: [String], default: [] },
  outgoingRequests: { type: [String], default: [] },

  notifications: { type: [notificationSchema], default: [] },
});
module.exports = mongoose.model("User", schema);
