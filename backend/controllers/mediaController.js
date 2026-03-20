const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

/**
 * Uploads a file buffer directly to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {Object} options - Cloudinary upload options (e.g. resource_type)
 * @returns {Promise} Cloudinary response
 */
const uploadFromBuffer = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const { nextTick } = require('process');
const logger = require('../utils/logger');

/**
 * POST /api/media/upload
 * Handles both images and audio uploads with strict validation.
 */
const uploadMedia = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  // 1. File Size Validation (e.g., 10MB limit)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (req.file.size > MAX_SIZE) {
    return res.status(400).json({ success: false, message: 'File too large. Max 10MB allowed.' });
  }

  // 2. Mimetype Validation
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a'
  ];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ success: false, message: 'Unsupported file type.' });
  }

  try {
    const isAudio = req.file.mimetype.startsWith('audio');
    
    const options = {
      resource_type: isAudio ? 'video' : 'image',
      folder: isAudio ? 'vibechat/audio' : 'vibechat/images',
    };

    const result = await uploadFromBuffer(req.file.buffer, options);

    return res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        type: isAudio ? 'audio' : 'image',
      }
    });
  } catch (error) {
    logger.error('Cloudinary upload error:', { error: error.message, file: req.file.originalname });
    next(error);
  }
};

module.exports = { uploadMedia };
