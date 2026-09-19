const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
  res.render('index', { title: 'Express' });
});

router.get("/servercheck", (req, res) => {
  res.status(200);
})
module.exports = router;
