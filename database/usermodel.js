const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: "lightgray",
  },
  image:{
    type: String,
    default: "none",
  },
  ip:{
    type:String,
    default:"none",
  },
  banned: {
    type: Boolean,
    default: false,
  },
  bannedReason:{
    type:String,
    default: "No reason specified.",
  },
  previousAccounts:{
    type: [String],
    default: [],
  }
});
module.exports = mongoose.model("User", schema);