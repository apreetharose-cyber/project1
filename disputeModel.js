const mongoose = require('mongoose');
require('./userModel');

const disputeSchema = new mongoose.Schema(
  {
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    raised_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    issue: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, enum: ['OPEN', 'IN_REVIEW', 'RESOLVED'], required: true, default: 'OPEN' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

disputeSchema.index({ status: 1 });

const Dispute = mongoose.model('Dispute', disputeSchema);

// Fetches the set of bookings belonging to `userId` (as farmer or owner),
// returning a lookup map of booking._id -> denormalized display fields.
// Equivalent to the SQL's `JOIN bookings b ... LEFT JOIN equipment/users`.
async function buildBookingInfoMap(bookingIds) {
  const Booking = mongoose.model('Booking');
  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .populate('equipment_id', 'equipment_type')
    .populate('owner_id', 'full_name')
    .populate('farmer_id', 'full_name')
    .lean();

  const map = {};
  bookings.forEach((b) => {
    map[b._id.toString()] = {
      equipment_id: b.equipment_id?._id ? b.equipment_id._id.toString() : b.equipment_id,
      equipment_name: b.equipment_id?.equipment_type,
      owner_name: b.owner_id?.full_name,
      renter_name: b.farmer_id?.full_name,
      farmer_id: b.farmer_id?._id ? b.farmer_id._id.toString() : b.farmer_id?.toString(),
      owner_id: b.owner_id?._id ? b.owner_id._id.toString() : (b.owner_id ? b.owner_id.toString() : null),
    };
  });
  return map;
}

function flattenDispute(doc, bookingInfo) {
  return {
    id: doc._id.toString(),
    booking_id: doc.booking_id ? doc.booking_id.toString() : null,
    raised_by: doc.raised_by ? doc.raised_by.toString() : null,
    issue: doc.issue,
    description: doc.description,
    status: doc.status,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    equipment_id: bookingInfo?.equipment_id || null,
    equipment_name: bookingInfo?.equipment_name || null,
    owner_name: bookingInfo?.owner_name || null,
    renter_name: bookingInfo?.renter_name || null,
  };
}

const disputeModel = {
  async create({ bookingId, raisedBy, issue, description }) {
    const doc = await Dispute.create({ booking_id: bookingId, raised_by: raisedBy, issue, description: description || null, status: 'OPEN' });
    return doc.id;
  },

  async findByUser(userId, { bookingId } = {}) {
    const Booking = mongoose.model('Booking');
    // Restrict to bookings this user is a party to (farmer or owner),
    // equivalent to the SQL's `WHERE (b.farmer_id = ? OR b.owner_id = ?)`.
    const userBookings = await Booking.find({ $or: [{ farmer_id: userId }, { owner_id: userId }] }, '_id').lean();
    const userBookingIds = userBookings.map((b) => b._id);

    const filter = { booking_id: { $in: userBookingIds } };
    if (bookingId) filter.booking_id = bookingId;

    const disputes = await Dispute.find(filter).sort({ created_at: -1 }).lean();
    const infoMap = await buildBookingInfoMap(disputes.map((d) => d.booking_id).filter(Boolean));

    return disputes.map((d) => flattenDispute(d, d.booking_id ? infoMap[d.booking_id.toString()] : null));
  },

  async findAllForAdmin() {
    const disputes = await Dispute.find({}).sort({ created_at: -1 }).lean();
    const infoMap = await buildBookingInfoMap(disputes.map((d) => d.booking_id).filter(Boolean));
    return disputes.map((d) => flattenDispute(d, d.booking_id ? infoMap[d.booking_id.toString()] : null));
  },

  async setStatus(id, status) {
    await Dispute.findByIdAndUpdate(id, { status });
  },

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Dispute.findById(id).lean();
    if (!doc) return null;
    return { ...doc, id: doc._id.toString(), booking_id: doc.booking_id.toString() };
  },
};

module.exports = disputeModel;
