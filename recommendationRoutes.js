const express = require('express');
const recommendationController = require('../controllers/recommendationController');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, requireRole('FARMER'), recommendationController.getRecommendations);

module.exports = router;