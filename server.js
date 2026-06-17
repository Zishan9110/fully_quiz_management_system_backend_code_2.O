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

// PASSPORT
const passport = require('passport');
require('./config/passport');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./sockets');

// Route imports
const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const adminRoutes = require('./routes/admin');
const quizRoutes = require('./routes/quizzes');
const courseRoutes = require('./routes/courses');
const questionRoutes = require('./routes/questions');
const resultRoutes = require('./routes/results');
const leaderboardRoutes = require('./routes/leaderboard');
const announcementRoutes = require('./routes/announcements');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const aiRoutes = require('./routes/ai');
const uploadRoutes = require('./routes/uploads');
const paymentRoutes = require('./routes/paymentRoutes');

// Connect DB
connectDB();

const app = express();
const server = http.createServer(app);

// ✅ Trust proxy for rate limiting (for Render)
app.set('trust proxy', 1);

// Init Socket.IO
initSocket(server);

// ✅ FORCE PRODUCTION URL
const PROD_URL = 'https://learnova-platform.vercel.app';
console.log('🔗 Using PROD_URL:', PROD_URL);

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
  origin: [PROD_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

app.use(passport.initialize());

// Logging
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Static uploads
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'QuizMaster API is running', timestamp: new Date(), version: '1.0.0' });
});

console.log('🔧 Registering Routes...');

// Admin routes FIRST
app.use('/api/admin/auth', authLimiter, adminAuthRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);

console.log('✅ API Routes Registered');

// ============================================
// AUTH REDIRECT HANDLERS
// ============================================

// Admin Auth Success Handler
app.get('/admin/auth-success', (req, res) => {
  console.log('✅ Admin auth success callback received');
  console.log('📝 Query params:', req.query);
  
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
  const redirectUrl = `${PROD_URL}/admin/auth-success${queryString ? '?' + queryString : ''}`;
  console.log('🔄 Redirecting to frontend:', redirectUrl);
  res.redirect(302, redirectUrl);
});

// Admin Login Handler
app.get('/admin/login', (req, res) => {
  console.log('🔄 Admin login redirect with params:', req.query);
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
  const redirectUrl = `${PROD_URL}/admin/login${queryString ? '?' + queryString : ''}`;
  console.log('🔄 Redirecting to:', redirectUrl);
  res.redirect(302, redirectUrl);
});

// Student Auth Success Handler
app.get('/auth-success', (req, res) => {
  console.log('✅ Student auth success callback received');
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
  const redirectUrl = `${PROD_URL}/auth-success${queryString ? '?' + queryString : ''}`;
  console.log('🔄 Redirecting to frontend:', redirectUrl);
  res.redirect(302, redirectUrl);
});

// Student Login Handler
app.get('/login', (req, res) => {
  console.log('🔄 Student login redirect with params:', req.query);
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
  const redirectUrl = `${PROD_URL}/login${queryString ? '?' + queryString : ''}`;
  console.log('🔄 Redirecting to:', redirectUrl);
  res.redirect(302, redirectUrl);
});

// ============================================
// 404 Handler
// ============================================
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
  logger.info(`Client URL: ${PROD_URL}`);
  logger.info(`Gemini AI: ${process.env.GEMINI_API_KEY ? 'enabled' : 'disabled'}`);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;