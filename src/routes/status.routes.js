const express = require('express');
const router = express.Router();
const statusController = require('../controllers/status.controller');

router.get('/status/:id', statusController.getStatus);
router.get('/result/:id', statusController.getResult);

module.exports = router;
