const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const { getSettings, updateSetting, bulkUpdateSettings } = require('../controllers/settingsController');

router.get('/', getSettings);
router.put('/bulk', protectAdmin, bulkUpdateSettings);
router.put('/:key', protectAdmin, updateSetting);
module.exports = router;
