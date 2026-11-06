const disputeService = require('../services/disputeService');
const asyncHandler = require('../utils/asyncHandler');

const disputeController = {
  create: asyncHandler(async (req, res) => { const disputeId = await disputeService.create(req.user.id, req.body); res.status(201).json({ success: true, message: 'Issue reported. Our team will review it.', disputeId }); }),
  getMine: asyncHandler(async (req, res) => { const disputes = await disputeService.getMyDisputes(req.user.id, { bookingId: req.query.bookingId }); res.json({ disputes }); }),
};

module.exports = disputeController;