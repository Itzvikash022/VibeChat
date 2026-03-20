const express = require('express');
const router = express.Router();
const { getUserById, getUserByVibeId, updateVibeId, updatePushToken } = require('../controllers/userController');

router.get('/:id', getUserById);
router.get('/search/:vibeId', getUserByVibeId);
router.patch('/vibe-id', updateVibeId);
router.put('/push-token', updatePushToken);

module.exports = router;
