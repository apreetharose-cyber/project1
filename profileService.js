const userModel = require('../models/userModel');
const profileModel = require('../models/profileModel');
const kycModel = require('../models/kycModel');
const bookingModel = require('../models/bookingModel');

const profileService = {
  async getFullProfile(userId) {
    const user = await userModel.findById(userId);
    const profile = await profileModel.findByUserId(userId);
    const kyc = await kycModel.findByUserId(userId);
    const trustStats = await bookingModel.trustStatsForUser(userId);

    // Simple trust score: base 100, penalized by disputes and late returns.
    // Only shown once the user has at least one completed booking; "New User"
    // otherwise — matches the frontend's TrustScoreCard behavior.
    let trust = null;
    if (trustStats.completedRentals > 0) {
      const disputePenalty = Math.min(trustStats.disputes * 15, 60);
      const onTimeRate = trustStats.onTimeReturns / trustStats.completedRentals;
      const score = Math.max(0, Math.round(100 - disputePenalty - (1 - onTimeRate) * 20));
      trust = { score, ...trustStats };
    }

    return {
      profile: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profilePhotoUrl: profile?.profile_photo || null,
        address: profile?.address || null,
        district: profile?.district || null,
        state: profile?.state || null,
        trust,
      },
      kyc: { status: kyc.status, rejectionReason: kyc.rejection_reason },
    };
  },

  async updateProfile(userId, fields, files) {
    const { fullName, mobile, address, district, state, role } = fields;

    if (role) {
      await userModel.setRole(userId, role);
      await kycModel.ensureExists(userId);
    }
    if (fullName !== undefined || mobile !== undefined) {
      await userModel.setBasicDetails(userId, { fullName, mobile });
    }

    const profilePhotoPath = files?.profilePhoto?.[0]
      ? `/uploads/profiles/${files.profilePhoto[0].filename}`
      : undefined;

    if (address !== undefined || district !== undefined || state !== undefined || profilePhotoPath) {
      await profileModel.upsert(userId, { profilePhoto: profilePhotoPath, address, district, state });
    }
  },
};

module.exports = profileService;