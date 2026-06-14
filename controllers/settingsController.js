const Settings = require('../models/Settings');
const asyncHandler = require('../middleware/asyncHandler');

exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.find(req.admin ? {} : { isPublic: true });
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json({ success: true, data: obj });
});

exports.updateSetting = asyncHandler(async (req, res) => {
  const setting = await Settings.findOneAndUpdate(
    { key: req.params.key },
    { value: req.body.value, group: req.body.group, description: req.body.description, isPublic: req.body.isPublic },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, data: setting });
});

exports.bulkUpdateSettings = asyncHandler(async (req, res) => {
  const updates = req.body.settings;
  const ops = updates.map(({ key, value, group, isPublic }) => ({
    updateOne: { filter: { key }, update: { key, value, group, isPublic }, upsert: true }
  }));
  await Settings.bulkWrite(ops);
  res.json({ success: true, message: 'Settings updated' });
});
