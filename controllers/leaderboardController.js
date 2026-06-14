const Leaderboard = require('../models/Leaderboard');
const Result = require('../models/Result');
const asyncHandler = require('../middleware/asyncHandler');

exports.getLeaderboard = asyncHandler(async (req, res) => {
  const { type = 'global', course, limit = 50 } = req.query;
  const query = { type };
  if (course) query.course = course;

  const entries = await Leaderboard.find(query)
    .populate('student', 'firstName lastName profilePicture')
    .sort({ rank: 1 })
    .limit(Number(limit));

  res.json({ success: true, data: entries });
});

exports.getMyRank = asyncHandler(async (req, res) => {
  const ranks = await Leaderboard.find({ student: req.user._id });
  res.json({ success: true, data: ranks });
});

exports.rebuildLeaderboard = asyncHandler(async (req, res) => {
  const { type = 'global' } = req.body;
  await Leaderboard.deleteMany({ type });

  const results = await Result.aggregate([
    { $match: { isPublished: true } },
    { $group: { _id: '$student', avgScore: { $avg: '$percentage' }, totalScore: { $sum: '$marksObtained' } } },
    { $sort: { avgScore: -1 } }
  ]);

  const entries = results.map((r, i) => ({
    student: r._id, score: r.totalScore, percentage: r.avgScore,
    rank: i + 1, type
  }));

  await Leaderboard.insertMany(entries);
  res.json({ success: true, message: 'Leaderboard rebuilt', count: entries.length });
});
