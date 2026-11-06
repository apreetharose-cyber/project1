const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    full_name: { type: String, default: null },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, default: null },
    mobile: { type: String, default: null },
    role: { type: String, enum: ['FARMER', 'EQUIPMENT_OWNER', 'FARM_LABOUR', 'ADMIN'], default: null },
    email_verified: { type: Boolean, required: true, default: false },
    verification_token: { type: String, default: null },
    verification_token_expiry: { type: Date, default: null },
    reset_token: { type: String, default: null },
    reset_token_expiry: { type: Date, default: null },
    account_status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], required: true, default: 'ACTIVE' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.index({ role: 1 });
userSchema.index({ account_status: 1 });

// Every model in this app used the mysql2 numeric `id` field. Mongoose docs
// use `_id` (an ObjectId) instead -- this virtual keeps `.id` working as a
// string everywhere the rest of the codebase already reads `user.id`,
// `row.owner_id`, etc., without having to touch every service/controller.
userSchema.virtual('id').get(function () {
  return this._id.toString();
});

const User = mongoose.model('User', userSchema);

const userModel = {
  async create({ email }) {
    const doc = await User.create({ email, email_verified: false });
    return doc.id;
  },

  async findByEmail(email) {
    return User.findOne({ email });
  },

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return User.findById(id);
  },

  async setVerificationToken(userId, token, expiry) {
    await User.findByIdAndUpdate(userId, { verification_token: token, verification_token_expiry: expiry });
  },

  async findByVerificationToken(token) {
    return User.findOne({ verification_token: token, verification_token_expiry: { $gt: new Date() } });
  },

  async markEmailVerified(userId) {
    await User.findByIdAndUpdate(userId, {
      email_verified: true,
      verification_token: null,
      verification_token_expiry: null,
    });
  },

  async setPassword(userId, passwordHash) {
    await User.findByIdAndUpdate(userId, { password_hash: passwordHash });
  },

  async setRole(userId, role) {
    await User.findByIdAndUpdate(userId, { role });
  },

  async setBasicDetails(userId, { fullName, mobile }) {
    const update = {};
    if (fullName !== undefined) update.full_name = fullName;
    if (mobile !== undefined) update.mobile = mobile;
    if (Object.keys(update).length === 0) return;
    await User.findByIdAndUpdate(userId, update);
  },

  async setResetToken(userId, token, expiry) {
    await User.findByIdAndUpdate(userId, { reset_token: token, reset_token_expiry: expiry });
  },

  async findByResetToken(token) {
    return User.findOne({ reset_token: token, reset_token_expiry: { $gt: new Date() } });
  },

  async clearResetToken(userId) {
    await User.findByIdAndUpdate(userId, { reset_token: null, reset_token_expiry: null });
  },

  async setAccountStatus(userId, status) {
    await User.findByIdAndUpdate(userId, { account_status: status });
  },

  async listWithFilters({ role, kycStatus, accountStatus }) {
    // kyc is a separate collection now (no LEFT JOIN in Mongo), so this
    // fetches users first, then merges in each user's KYC status.
    const filter = { role: { $in: ['FARMER', 'EQUIPMENT_OWNER', 'FARM_LABOUR'] } };
    if (role) filter.role = role;
    if (accountStatus) filter.account_status = accountStatus;

    const users = await User.find(filter).sort({ created_at: -1 }).lean();

    // Lazy-require to avoid a circular require (kycModel doesn't need userModel).
    const kycModel = require('./kycModel');
    const kycMap = await kycModel.mapStatusByUserIds(users.map((u) => u._id));

    let rows = users.map((u) => ({
      id: u._id.toString(),
      full_name: u.full_name,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      account_status: u.account_status,
      kyc_status: kycMap[u._id.toString()] || 'NOT_SUBMITTED',
    }));

    if (kycStatus) rows = rows.filter((r) => r.kyc_status === kycStatus);

    return rows;
  },

  async countByRole(role) {
    return User.countDocuments({ role });
  },

  async countAllNonAdmin() {
    return User.countDocuments({ role: { $in: ['FARMER', 'EQUIPMENT_OWNER', 'FARM_LABOUR'] } });
  },
};

module.exports = userModel;
