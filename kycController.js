const kycService = require('../services/kycService');
const asyncHandler = require('../utils/asyncHandler');

const kycController = {
  getStatus: asyncHandler(async (req, res) => {
    const kyc = await kycService.getStatus(req.user.id);
    res.json({ kyc });
  }),

  submit: asyncHandler(async (req, res) => {
    const documentPath = req.files?.document?.[0] ? `/uploads/profiles/${req.files.document[0].filename}` : null;
    await kycService.submit(req.user.id, { documentType: req.body.documentType, documentPath });
    res.json({ success: true, message: 'KYC submitted for review.' });
  }),

  resubmit: asyncHandler(async (req, res) => {
    await kycService.resubmit(req.user.id);
    res.json({ success: true, message: 'KYC resubmitted for review.' });
  }),
};

module.exports = kycController;