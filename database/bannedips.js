const mongoose = require("mongoose");
const schema = new mongoose.Schema(
    {
    ip:{
        type:String,
        required: true,
    },
    banned:{
        type:Boolean,
        default: true
    },
    bannedReason:{
        type: String,
        default: "No reason given",
    }
})
module.exports = mongoose.model("bannedIps",schema)