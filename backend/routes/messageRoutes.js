const express = require('express');
const router = express.Router();
const { deleteHistory, getConversations, addConversation } = require('../controllers/messageController');

// GET /messages/conversations?userId=... — load all conversations from DB
router.get('/conversations', getConversations);

// POST /messages/conversations — "add" a new conversation partner
router.post('/conversations', addConversation);

// DELETE /messages — delete chat history (self or both)
router.delete('/', deleteHistory);

module.exports = router;
