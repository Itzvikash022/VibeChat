const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware
 * Verifies the Bearer token in the Authorization header.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      next();
    } catch (error) {
      console.error('Auth check error:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

/**
 * Socket.io Auth Middleware
 * Verifies token during handshake.
 */
const socketAuth = async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.token;
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select('_id username');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    socket.user = user;
    next();
  } catch (err) {
    console.error('Socket Auth error:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = { protect, socketAuth };
