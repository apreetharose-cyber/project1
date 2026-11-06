const express = require('express');
const disputeController = require('../controllers/disputeController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, disputeController.create);
router.get('/my', protect, disputeController.getMine);

module.exports = router;