const express = require("express");
router = express.Router();
router.get("/", (req, res) => {
    res.sendStatus(418);
});
router.post("/", (req, res) => {
    res.json({...req.body, time: new Date().toLocaleDateString()})
})
module.exports = router;