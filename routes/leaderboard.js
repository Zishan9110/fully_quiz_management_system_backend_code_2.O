const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const { getLeaderboard, getMyRank, rebuildLeaderboard } = require('../controllers/leaderboardController');

router.get('/', getLeaderboard);
router.get('/my-rank', protect, getMyRank);
router.post('/rebuild', protectAdmin, rebuildLeaderboard);
module.exports = router;
