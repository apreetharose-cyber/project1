const express = require('express');
const ratingController = require('../controllers/ratingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, ratingController.submit);
router.get('/equipment/:id', ratingController.getForEquipment);

module.exports = router;