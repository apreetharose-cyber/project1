const ratingService = require('../services/ratingService');
const asyncHandler = require('../utils/asyncHandler');

const ratingController = {
  submit: asyncHandler(async (req, res) => { await ratingService.submit(req.user.id, req.body); res.json({ success: true, message: 'Thanks! Your review has been submitted.' }); }),
  getForEquipment: asyncHandler(async (req, res) => { const ratings = await ratingService.getForEquipment(req.params.id); res.json({ ratings }); }),
};

module.exports = ratingController;