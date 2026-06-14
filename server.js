// server.js - Add payment routes import at the top with other routes
const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

dotenv.config();

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./sockets');

// Route imports
const authRoutes         = require('./routes/auth');
const adminAuthRoutes    = require('./routes/adminAuth');
const adminRoutes        = require('./routes/admin');
const quizRoutes         = require('./routes/quizzes');
const courseRoutes       = require('./routes/courses');
const questionRoutes     = require('./routes/questions');
const resultRoutes       = require('./routes/results');
const leaderboardRoutes  = require('./routes/leaderboard');
const announcementRoutes = require('./routes/announcements');
const messageRoutes      = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes     = require('./routes/settings');
const aiRoutes           = require('./routes/ai');
const uploadRoutes       = require('./routes/uploads');

// 🔥 ADD THIS - Payment routes import
const paymentRoutes = require('./routes/paymentRoutes');

// Connect DB
connectDB();

const app = express();
const server = http.createServer(app);

// Init Socket.IO
initSocket(server);

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many auth attempts.' }
});

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Static uploads (local fallback)
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'QuizMaster API is running', timestamp: new Date(), version: '1.0.0' });
});

// Routes
app.use('/api/auth',           authLimiter, authRoutes);
app.use('/api/admin/auth',     authLimiter, adminAuthRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/quizzes',        quizRoutes);
app.use('/api/courses',        courseRoutes);
app.use('/api/questions',      questionRoutes);
app.use('/api/results',        resultRoutes);
app.use('/api/leaderboard',    leaderboardRoutes);
app.use('/api/announcements',  announcementRoutes);
app.use('/api/messages',       messageRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/settings',       settingsRoutes);
app.use('/api/ai',             aiRoutes);
app.use('/api/upload',         uploadRoutes);

// 🔥 ADD THIS - Payment routes (MUST be after body parsers)
app.use('/api/payments',       paymentRoutes);

// 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use(errorHandler);

// Cron jobs
require('./jobs');

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  logger.info(`Gemini AI: ${process.env.GEMINI_API_KEY ? 'enabled' : 'disabled (set GEMINI_API_KEY)'}`);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;