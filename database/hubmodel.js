const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    icon: { type: String, default: "fa-gamepad" },
    color: { type: String, default: "#0088ff" },
    creator: { type: String, required: true }, // email of whoever made it
    members: { type: [String], default: [] }, // usernames
    views: { type: Number, default: 0 },
    isPrivate: { type: Boolean, default: false },
    pendingRequests: { type: [String], default: [] }, // usernames awaiting owner approval
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hub", schema);
