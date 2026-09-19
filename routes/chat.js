const express = require("express");
const router = express.Router();
router.post("/chatroom", (req, res) => {
  res.send("route hit");
});
module.exports = router;
