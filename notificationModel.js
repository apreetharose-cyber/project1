const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    is_read: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

notificationSchema.index({ user_id: 1 });
notificationSchema.index({ is_read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

const notificationModel = {
  async create(userId, { type, title, message }) {
    await Notification.create({ user_id: userId, type, title, message });
  },

  async findByUser(userId) {
    return Notification.find({ user_id: userId }).sort({ created_at: -1 }).limit(50).lean();
  },

  async markRead(id, userId) {
    await Notification.findOneAndUpdate({ _id: id, user_id: userId }, { is_read: true });
  },
};

module.exports = notificationModel;
