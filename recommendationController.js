const recommendationService = require('../services/recommendationService');
const asyncHandler = require('../utils/asyncHandler');

const recommendationController = {
  getRecommendations: asyncHandler(async (req, res) => {
    const recommendations = await recommendationService.getRecommendations(req.body);
    res.json({ recommendations });
  }),
};

module.exports = recommendationController;