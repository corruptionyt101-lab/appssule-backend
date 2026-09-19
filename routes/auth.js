const authenticate = require("./authenticate.js");
const bannedAuthenticate = require("./banned.js");
const express = require("express");

const router = express.Router();
router.get("/", bannedAuthenticate, authenticate, async (req, res) => {
  const token = req.token;
  console.log("Authenticated user/user logged in: ", req.user);
  //delete this
  
  res
    .status(200)
    .json({ message: "Authenticated", user: req.user, token: token, isAdmin: req.isAdmin });
});
module.exports = router;
