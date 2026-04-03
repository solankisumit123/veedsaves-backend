const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/download.controller');

router.post('/parse', downloadController.parseVideo);
router.post('/download', downloadController.startDownload);
router.get('/proxy', downloadController.proxyImage);

module.exports = router;
