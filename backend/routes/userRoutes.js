const express = require('express');
const router = express.Router();
const { getUserById, getUserByVibeId, updateVibeId } = require('../controllers/userController');

router.get('/:id', getUserById);
router.get('/search/:vibeId', getUserByVibeId);
router.patch('/vibe-id', updateVibeId);

module.exports = router;
