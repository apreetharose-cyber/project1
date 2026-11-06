const kycModel = require('../models/kycModel');
const notificationModel = require('../models/notificationModel');
const AppError = require('../utils/AppError');

const kycService = {
  async getStatus(userId) {
    const kyc = await kycModel.findByUserId(userId);
    return { status: kyc.status, rejectionReason: kyc.rejection_reason, submittedAt: kyc.submitted_at, reviewedAt: kyc.reviewed_at };
  },

  async submit(userId, { documentType, documentPath }) {
    await kycModel.submit(userId, { documentType, documentPath });
  },

  async resubmit(userId) {
    await kycModel.submit(userId, {});
  },

  async approve(userId, adminId) {
    await kycModel.approve(userId, adminId);
    await notificationModel.create(userId, {
      type: 'KYC_RESULT',
      title: 'KYC Approved',
      message: 'Your account has been verified. You now have full access to the platform.',
    });
  },

  async reject(userId, adminId, reason) {
    if (!reason || !reason.trim()) throw new AppError('A rejection reason is required.', 422);
    await kycModel.reject(userId, adminId, reason.trim());
    await notificationModel.create(userId, {
      type: 'KYC_RESULT',
      title: 'KYC Rejected',
      message: `Your verification was rejected: ${reason.trim()}`,
    });
  },

  async listPending() {
    const rows = await kycModel.listPending();
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      role: r.role,
      district: r.district,
      profilePhotoUrl: r.profile_photo,
      documents: r.document_path ? [{ label: 'Submitted Document', url: r.document_path }] : [],
      status: r.status,
    }));
  },
};

module.exports = kycService;