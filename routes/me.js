const express = require("express");
const router = express.Router();
const User = require("../database/usermodel");
const authenticate = require("./authenticate");

router.use(authenticate);

// Returns the logged-in user's full profile (safe fields only) so the
// frontend can rehydrate currentUser after a page reload, using just the
// httpOnly auth cookie — no token needs to be stored client-side for this.
router.get("/", async (req, res) => {
  const user = await User.findOne({ email: req.user }).select(
    "-password -ip -previousAccounts -__v"
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

module.exports = router;
