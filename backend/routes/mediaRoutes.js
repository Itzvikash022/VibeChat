const express = require('express');
const multer = require('multer');
const router = express.Router();
const { uploadMedia } = require('../controllers/mediaController');

// Multer in-memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /media/upload
 * Uploads an image or an audio file.
 */
router.post('/upload', upload.single('file'), uploadMedia);

module.exports = router;
