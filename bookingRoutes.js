const express = require('express');
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, bookingController.create);
router.get('/', protect, bookingController.getMine); // supports ?forOwner=true&status=PENDING
router.get('/my', protect, bookingController.getMy);
router.get('/:id', protect, bookingController.getById);

router.put('/:id/accept', protect, bookingController.accept);
router.put('/:id/reject', protect, bookingController.reject);
router.put('/:id/cancel', protect, bookingController.cancel);
router.put('/:id/handover', protect, bookingController.handover);
router.put('/:id/complete', protect, bookingController.complete);
router.post('/:id/report-issue', protect, bookingController.reportIssue);

module.exports = router;