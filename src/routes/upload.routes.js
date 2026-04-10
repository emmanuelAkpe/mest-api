const express = require('express');
const multer = require('multer');
const { upload } = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

const memoryStorage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/', authenticate, memoryStorage.single('file'), upload);

module.exports = router;
