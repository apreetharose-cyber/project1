const disputeModel = require('../models/disputeModel');
const bookingModel = require('../models/bookingModel');
const notificationModel = require('../models/notificationModel');
const AppError = require('../utils/AppError');

function formatDispute(row) {
  return {
    id: row.id, bookingId: row.booking_id, equipmentName: row.equipment_name,
    ownerName: row.owner_name, renterName: row.renter_name,
    issue: row.issue, description: row.description, status: row.status, date: row.created_at,
  };
}

const disputeService = {
  async create(userId, { bookingId, issue, description }) {
    const booking = await bookingModel.findById(bookingId);
    if (!booking) throw new AppError('Booking not found.', 404);
    if (![booking.farmer_id, booking.owner_id].includes(userId)) {
      throw new AppError('You do not have permission to report an issue for this booking.', 403);
    }

    // The system only records the reported issue for admin review — it
    // never automatically assigns blame, per section 28.
    const disputeId = await disputeModel.create({ bookingId, raisedBy: userId, issue, description });
    await bookingModel.updateStatus(bookingId, 'DISPUTED');

    const otherParty = booking.farmer_id === userId ? booking.owner_id : booking.farmer_id;
    if (otherParty) {
      await notificationModel.create(otherParty, { type: 'DISPUTE_UPDATE', title: 'Issue Reported', message: `An issue was reported on booking #${bookingId}. Our team will review it.` });
    }

    return disputeId;
  },

  async getMyDisputes(userId, filters) {
    const rows = await disputeModel.findByUser(userId, filters);
    return rows.map(formatDispute);
  },

  async getAllForAdmin() {
    const rows = await disputeModel.findAllForAdmin();
    return rows.map(formatDispute);
  },

  async markInReview(id) { await disputeModel.setStatus(id, 'IN_REVIEW'); },

  async resolve(id) {
    const dispute = await disputeModel.findById(id);
    if (!dispute) throw new AppError('Dispute not found.', 404);
    await disputeModel.setStatus(id, 'RESOLVED');
    // Resolving returns the booking to COMPLETED — an admin has manually
    // reviewed and closed the case; no automated fault assignment.
    await bookingModel.updateStatus(dispute.booking_id, 'COMPLETED');
  },
};

module.exports = disputeService;