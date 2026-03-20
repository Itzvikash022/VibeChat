const express = require('express');
const router = express.Router();
const { createSticker, getMyStickers, deleteSticker } = require('../controllers/stickerController');

router.post('/', createSticker);
router.get('/me', getMyStickers);
router.delete('/:id', deleteSticker);

module.exports = router;
