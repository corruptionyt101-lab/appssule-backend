const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    id: mongoose.Schema.Types.ObjectId,
    roomId: {
      type: String,
      default: "main",
    },
  },

  { timestamps: true }
);
module.exports = mongoose.model("ChatModel", schema);