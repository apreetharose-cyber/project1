const ratingModel = require('../models/ratingModel');
const bookingModel = require('../models/bookingModel');
const AppError = require('../utils/AppError');

const ratingService = {
  async submit(userId, { bookingId, stars, review }) {
    if (!stars || stars < 1 || stars > 5) throw new AppError('Please select a rating between 1 and 5 stars.', 422);

    const booking = await bookingModel.findById(bookingId);
    if (!booking) throw new AppError('Booking not found.', 404);
    if (![booking.farmer_id, booking.owner_id, booking.labourer_id].includes(userId)) {
      throw new AppError('You do not have permission to rate this booking.', 403);
    }
    if (booking.status !== 'COMPLETED') throw new AppError('You can only rate a completed booking.', 400);

    const alreadyRated = await ratingModel.existsForBooking(bookingId, userId);
    if (alreadyRated) throw new AppError('You have already rated this booking.', 409);

    const ratedUser = userId === booking.farmer_id ? (booking.owner_id || booking.labourer_id) : booking.farmer_id;

    await ratingModel.create({ bookingId, equipmentId: booking.equipment_id, ratedBy: userId, ratedUser, stars, review });
  },

  async getForEquipment(equipmentId) {
    const rows = await ratingModel.findByEquipment(equipmentId);
    return rows.map((r) => ({ stars: r.stars, review: r.review, reviewerName: r.reviewer_name, date: r.created_at }));
  },
};

module.exports = ratingService;