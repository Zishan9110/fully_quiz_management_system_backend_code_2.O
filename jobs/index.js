const cron = require('node-cron');
const logger = require('../utils/logger');

// Auto-submit timed out quiz attempts
cron.schedule('*/5 * * * *', async () => {
  try {
    const QuizAttempt = require('../models/QuizAttempt');
    const Quiz = require('../models/Quiz');
    const now = new Date();

    const inProgress = await QuizAttempt.find({ status: 'in_progress' }).populate('quiz', 'duration');
    for (const attempt of inProgress) {
      const elapsed = (now - attempt.startTime) / 60000;
      if (elapsed > attempt.quiz.duration + 2) {
        attempt.status = 'timed_out';
        attempt.endTime = now;
        await attempt.save();
        logger.info(`Auto-submitted attempt ${attempt._id}`);
      }
    }
  } catch (e) { logger.error('Auto-submit job error:', e.message); }
});

// Rebuild leaderboard daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const Leaderboard = require('../models/Leaderboard');
    const Result = require('../models/Result');
    await Leaderboard.deleteMany({ type: 'global' });

    const results = await Result.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$student', avgScore: { $avg: '$percentage' }, totalScore: { $sum: '$marksObtained' } } },
      { $sort: { avgScore: -1 } }
    ]);

    const entries = results.map((r, i) => ({
      student: r._id, score: r.totalScore, percentage: r.avgScore, rank: i + 1, type: 'global'
    }));
    if (entries.length) await Leaderboard.insertMany(entries);
    logger.info(`Leaderboard rebuilt: ${entries.length} entries`);
  } catch (e) { logger.error('Leaderboard job error:', e.message); }
});

// Clean old notifications (30 days)
cron.schedule('0 2 * * 0', async () => {
  try {
    const Notification = require('../models/Notification');
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { deletedCount } = await Notification.deleteMany({ createdAt: { $lt: cutoff }, isRead: true });
    logger.info(`Cleaned ${deletedCount} old notifications`);
  } catch (e) { logger.error('Notification cleanup error:', e.message); }
});

logger.info('Cron jobs initialized');
