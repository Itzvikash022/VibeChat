const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');

// POST /auth/register — create new account
router.post('/register', register);

// POST /auth/login — verify credentials
router.post('/login', login);

// POST /auth/refresh — rotate tokens
router.post('/refresh', refresh);

// POST /auth/logout — clear session
router.post('/logout', logout);

module.exports = router;
