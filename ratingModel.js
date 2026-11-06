const mongoose = require('mongoose');
require('./userModel');

const ratingSchema = new mongoose.Schema(
  {
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', default: null },
    rated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rated_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    stars: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

ratingSchema.index({ booking_id: 1, rated_by: 1 }, { unique: true });
ratingSchema.index({ equipment_id: 1 });

const Rating = mongoose.model('Rating', ratingSchema);

const ratingModel = {
  async create({ bookingId, equipmentId, ratedBy, ratedUser, stars, review }) {
    await Rating.create({
      booking_id: bookingId,
      equipment_id: equipmentId || null,
      rated_by: ratedBy,
      rated_user: ratedUser || null,
      stars,
      review: review || null,
    });
  },

  async existsForBooking(bookingId, ratedBy) {
    const doc = await Rating.findOne({ booking_id: bookingId, rated_by: ratedBy }, '_id').lean();
    return Boolean(doc);
  },

  async findByEquipment(equipmentId) {
    const rows = await Rating.find({ equipment_id: equipmentId })
      .sort({ created_at: -1 })
      .populate('rated_by', 'full_name')
      .lean();

    return rows.map((r) => ({
      ...r,
      reviewer_name: r.rated_by?.full_name,
    }));
  },
};

module.exports = ratingModel;
