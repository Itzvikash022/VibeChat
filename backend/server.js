// ⚠️ MUST be first — loads .env before any module reads process.env
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const stickerRoutes = require('./routes/stickerRoutes');

const { protect, socketAuth } = require('./middlewares/authMiddleware');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
const initSocket = require('./sockets');
const logger = require('./utils/logger');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Security Handening
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Compress responses

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};
app.use(cors(process.env.NODE_ENV === 'production' ? corsOptions : { origin: '*' }));

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/auth', authLimiter);

app.use(express.json());

// API Routes
app.use('/auth', authRoutes); // Public auth routes

// Protected Routes
app.use('/users', protect, userRoutes);
app.use('/messages', protect, messageRoutes);
app.use('/media', protect, mediaRoutes);
app.use('/stickers', protect, stickerRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'VibeChat backend is running.', version: '1.1.0' });
});

// Middleware for 404 and Error Handling
app.use(notFound);
app.use(errorHandler);

// Initialize Socket.io with Auth
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.use(socketAuth); // Protect socket connections
initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT} (0.0.0.0)`);
});
