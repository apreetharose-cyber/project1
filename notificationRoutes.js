const express = require('express');
const notificationModel = require('../models/notificationModel');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', protect, asyncHandler(async (req, res) => {
  const notifications = await notificationModel.findByUser(req.user.id);
  res.json({ notifications });
}));

router.put('/:id/read', protect, asyncHandler(async (req, res) => {
  await notificationModel.markRead(req.params.id, req.user.id);
  res.json({ success: true });
}));

module.exports = router;