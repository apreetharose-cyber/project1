const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    profile_photo: { type: String, default: null },
    address: { type: String, default: null },
    district: { type: String, default: null },
    state: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

profileSchema.index({ district: 1 });

const Profile = mongoose.model('Profile', profileSchema);

const profileModel = {
  async upsert(userId, { profilePhoto, address, district, state }) {
    const update = {};
    if (profilePhoto !== undefined) update.profile_photo = profilePhoto;
    if (address !== undefined) update.address = address;
    if (district !== undefined) update.district = district;
    if (state !== undefined) update.state = state;
    if (Object.keys(update).length === 0) return;

    await Profile.findOneAndUpdate(
      { user_id: userId },
      { $set: update, $setOnInsert: { user_id: userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },

  async findByUserId(userId) {
    return Profile.findOne({ user_id: userId }).lean();
  },
};

module.exports = profileModel;
