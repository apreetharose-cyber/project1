const mongoose = require('mongoose');
require('./profileModel'); // ensures the 'Profile' model is registered before listPending() looks it up

const kycSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: {
      type: String,
      enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
      required: true,
      default: 'NOT_SUBMITTED',
    },
    document_type: { type: String, default: null },
    document_path: { type: String, default: null },
    rejection_reason: { type: String, default: null },
    submitted_at: { type: Date, default: null },
    reviewed_at: { type: Date, default: null },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

kycSchema.index({ status: 1 });

const Kyc = mongoose.model('Kyc', kycSchema);

const kycModel = {
  async ensureExists(userId) {
    await Kyc.findOneAndUpdate(
      { user_id: userId },
      { $setOnInsert: { user_id: userId, status: 'NOT_SUBMITTED' } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  },

  async findByUserId(userId) {
    await kycModel.ensureExists(userId);
    return Kyc.findOne({ user_id: userId });
  },

  async submit(userId, { documentType, documentPath }) {
    await kycModel.ensureExists(userId);
    await Kyc.findOneAndUpdate(
      { user_id: userId },
      {
        status: 'PENDING',
        document_type: documentType || null,
        document_path: documentPath || null,
        rejection_reason: null,
        submitted_at: new Date(),
      }
    );
  },

  async listPending() {
    // Replaces: JOIN users + LEFT JOIN profiles, filtered to status = PENDING.
    const kycRows = await Kyc.find({ status: 'PENDING' })
      .sort({ submitted_at: 1 })
      .populate('user_id', 'full_name role')
      .lean();

    const userIds = kycRows.map((k) => k.user_id?._id).filter(Boolean);
    const Profile = mongoose.model('Profile');
    const profiles = await Profile.find({ user_id: { $in: userIds } }).lean();
    const profileMap = {};
    profiles.forEach((p) => { profileMap[p.user_id.toString()] = p; });

    return kycRows.map((k) => {
      const profile = profileMap[k.user_id?._id?.toString()] || {};
      return {
        user_id: k.user_id?._id?.toString(),
        name: k.user_id?.full_name,
        role: k.user_id?.role,
        district: profile.district || null,
        profile_photo: profile.profile_photo || null,
        document_path: k.document_path,
        status: k.status,
        submitted_at: k.submitted_at,
      };
    });
  },

  async approve(userId, reviewerId) {
    await Kyc.findOneAndUpdate(
      { user_id: userId },
      { status: 'APPROVED', rejection_reason: null, reviewed_at: new Date(), reviewed_by: reviewerId }
    );
  },

  async reject(userId, reviewerId, reason) {
    await Kyc.findOneAndUpdate(
      { user_id: userId },
      { status: 'REJECTED', rejection_reason: reason, reviewed_at: new Date(), reviewed_by: reviewerId }
    );
  },

  async countByStatus(status) {
    return Kyc.countDocuments({ status });
  },

  /**
   * New helper (not present in the old SQL-backed model): replicates what
   * `LEFT JOIN kyc k ON k.user_id = u.id` gave userModel.listWithFilters()
   * for free in SQL. Returns { [userId]: status } for the given user ids.
   */
  async mapStatusByUserIds(userIds) {
    const rows = await Kyc.find({ user_id: { $in: userIds } }, 'user_id status').lean();
    const map = {};
    rows.forEach((r) => { map[r.user_id.toString()] = r.status; });
    return map;
  },
};

module.exports = kycModel;
