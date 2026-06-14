const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io;

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    // Join personal room
    socket.join(`user_${socket.userId}`);

    // Join quiz room for real-time updates
    socket.on('join_quiz', (quizId) => {
      socket.join(`quiz_${quizId}`);
    });

    socket.on('leave_quiz', (quizId) => {
      socket.leave(`quiz_${quizId}`);
    });

    // Typing indicator for messages
    socket.on('typing', ({ receiverId }) => {
      io.to(`user_${receiverId}`).emit('typing', { senderId: socket.userId });
    });

    socket.on('stop_typing', ({ receiverId }) => {
      io.to(`user_${receiverId}`).emit('stop_typing', { senderId: socket.userId });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { initSocket, getIO };
