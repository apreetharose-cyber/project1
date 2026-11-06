const mongoose = require('mongoose');
require('./userModel');
require('./equipmentModel');
require('./labourModel');
require('./profileModel');
require('./kycModel');

const bookingSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['EQUIPMENT_RENTAL', 'LABOUR_JOB'], required: true, default: 'EQUIPMENT_RENTAL' },
    equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', default: null },
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourJob', default: null },
    farmer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    labourer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    start_date: { type: Date, default: null },
    end_date: { type: Date, default: null },
    total_amount: { type: Number, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DISPUTED', 'EXPIRED'],
      required: true,
      default: 'PENDING',
    },
    handover_date: { type: Date, default: null },
    expected_return_date: { type: Date, default: null },
    actual_return_date: { type: Date, default: null },
    condition: { type: String, default: null },
    fuel_level: { type: String, default: null },
    requested_at: { type: Date, default: Date.now },
    response_deadline: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
    completed_at: { type: Date, default: null },
    rejected_at: { type: Date, default: null },
    expires_at: { type: Date, default: null },
    is_archived: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

bookingSchema.index({ status: 1 });
bookingSchema.index({ equipment_id: 1 });
bookingSchema.index({ farmer_id: 1 });
bookingSchema.index({ owner_id: 1 });
bookingSchema.index({ labourer_id: 1 });
bookingSchema.index({ is_archived: 1 });
bookingSchema.index({ response_deadline: 1 });
bookingSchema.index({ start_date: 1, end_date: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

// Populates every cross-reference a booking might need to display, then
// flattens the populated sub-documents into the same flat "row" property
// names the SQL joins used to produce (row.equipment_type, row.owner_name,
// row.farmer_name, row.labourer_name, row.job_work_type, ...), so
// bookingService.js's formatBooking() needs zero changes.
function populateBooking(query) {
  return query
    .populate('equipment_id', 'equipment_type brand model price_per_day images')
    .populate('owner_id', 'full_name')
    .populate('farmer_id', 'full_name')
    .populate('labourer_id', 'full_name')
    .populate('job_id', 'work_type work_description description land_size location expected_cost wage required_date work_date status');
}

function flattenBooking(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;

  const equipment = obj.equipment_id;
  const owner = obj.owner_id;
  const farmer = obj.farmer_id;
  const labourer = obj.labourer_id;
  const job = obj.job_id;

  return {
    id: obj._id.toString(),
    type: obj.type,
    equipment_id: equipment?._id ? equipment._id.toString() : (obj.equipment_id ? obj.equipment_id.toString() : null),
    job_id: job?._id ? job._id.toString() : (obj.job_id ? obj.job_id.toString() : null),
    farmer_id: farmer?._id ? farmer._id.toString() : (obj.farmer_id ? obj.farmer_id.toString() : null),
    owner_id: owner?._id ? owner._id.toString() : (obj.owner_id ? obj.owner_id.toString() : null),
    labourer_id: labourer?._id ? labourer._id.toString() : (obj.labourer_id ? obj.labourer_id.toString() : null),
    start_date: obj.start_date,
    end_date: obj.end_date,
    total_amount: obj.total_amount,
    status: obj.status,
    handover_date: obj.handover_date,
    expected_return_date: obj.expected_return_date,
    actual_return_date: obj.actual_return_date,
    condition: obj.condition,
    fuel_level: obj.fuel_level,
    requested_at: obj.requested_at || obj.created_at,
    response_deadline: obj.response_deadline || (obj.created_at ? new Date(new Date(obj.created_at).getTime() + 48 * 60 * 60 * 1000) : null),
    completed_at: obj.completed_at || (obj.status === 'COMPLETED' ? obj.actual_return_date || obj.updated_at : null),
    rejected_at: obj.rejected_at || (obj.status === 'REJECTED' ? obj.updated_at : null),
    expires_at: obj.expires_at || (obj.status === 'EXPIRED' ? obj.updated_at : null),
    is_archived: Boolean(obj.is_archived),
    created_at: obj.created_at,
    updated_at: obj.updated_at,
    // Denormalized display fields:
    equipment_type: equipment?.equipment_type,
    brand: equipment?.brand,
    model: equipment?.model,
    price_per_day: equipment?.price_per_day,
    equipment_photo: equipment?.images?.[0] || null,
    owner_name: owner?.full_name,
    farmer_name: farmer?.full_name,
    labourer_name: labourer?.full_name,
    job_work_type: job?.work_type,
    job_description: job?.work_description || job?.description,
    job_land_size: job?.land_size,
    job_location: job?.location,
    job_expected_cost: job?.expected_cost || job?.wage,
    job_required_date: job?.required_date || job?.work_date,
    job_status: job?.status,
  };
}

// Attaches renter_photo / renter_verified for a list of bookings, equivalent
// to `LEFT JOIN profiles` + `LEFT JOIN kyc` on the farmer_id in findForOwner().
async function attachRenterInfo(rows) {
  const Profile = mongoose.model('Profile');
  const Kyc = mongoose.model('Kyc');

  const farmerIds = rows.map((r) => r.farmer_id).filter(Boolean);
  const [profiles, kycs] = await Promise.all([
    Profile.find({ user_id: { $in: farmerIds } }, 'user_id profile_photo').lean(),
    Kyc.find({ user_id: { $in: farmerIds } }, 'user_id status').lean(),
  ]);
  const profileMap = {};
  profiles.forEach((p) => { if (p.user_id) profileMap[p.user_id.toString()] = p.profile_photo; });
  const kycMap = {};
  kycs.forEach((k) => { if (k.user_id) kycMap[k.user_id.toString()] = k.status; });

  return rows.map((r) => ({
    ...r,
    renter_name: r.farmer_name,
    renter_photo: profileMap[r.farmer_id] || null,
    renter_verified: kycMap[r.farmer_id] === 'APPROVED',
  }));
}

const bookingModel = {
  async autoExpireAndArchive() {
    try {
      const now = new Date();
      // 1. Auto-expire pending requests where response deadline passed (2 days / 48 hours)
      const expiredDocs = await Booking.find({
        status: 'PENDING',
        response_deadline: { $lt: now },
      }).select('_id job_id').lean();

      if (expiredDocs.length > 0) {
        const expiredIds = expiredDocs.map((b) => b._id);
        await Booking.updateMany(
          { _id: { $in: expiredIds } },
          { $set: { status: 'EXPIRED', expires_at: now } }
        );

        // For any labour job with an expired request, ensure the job remains OPEN if no other active booking
        const LabourJob = mongoose.model('LabourJob');
        for (const doc of expiredDocs) {
          if (doc.job_id) {
            const hasActiveBooking = await Booking.exists({
              job_id: doc.job_id,
              status: { $in: ['APPROVED', 'ACTIVE', 'BOOKED'] },
            });
            if (!hasActiveBooking) {
              await LabourJob.findByIdAndUpdate(doc.job_id, { status: 'OPEN' });
            }
          }
        }
      }

      // 2. Auto-archive completed bookings older than 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      await Booking.updateMany(
        {
          status: 'COMPLETED',
          is_archived: { $ne: true },
          $or: [
            { completed_at: { $lt: thirtyDaysAgo } },
            { completed_at: null, actual_return_date: { $lt: thirtyDaysAgo } },
            { completed_at: null, actual_return_date: null, updated_at: { $lt: thirtyDaysAgo } },
          ],
        },
        { $set: { is_archived: true } }
      );

      // 3. Auto-archive rejected or expired bookings older than 30 days
      await Booking.updateMany(
        {
          status: { $in: ['REJECTED', 'EXPIRED', 'CANCELLED'] },
          is_archived: { $ne: true },
          $or: [
            { rejected_at: { $lt: thirtyDaysAgo } },
            { expires_at: { $lt: thirtyDaysAgo } },
            { rejected_at: null, expires_at: null, updated_at: { $lt: thirtyDaysAgo } },
          ],
        },
        { $set: { is_archived: true } }
      );
    } catch (err) {
      console.error('Error running autoExpireAndArchive:', err);
    }
  },

  async createEquipmentBooking({ equipmentId, farmerId, ownerId, startDate, endDate, totalAmount }) {
    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const doc = await Booking.create({
      type: 'EQUIPMENT_RENTAL',
      equipment_id: equipmentId,
      farmer_id: farmerId,
      owner_id: ownerId,
      start_date: startDate,
      end_date: endDate,
      total_amount: totalAmount,
      status: 'PENDING',
      requested_at: now,
      response_deadline: deadline,
      is_archived: false,
    });
    return doc.id;
  },

  async createLabourBooking() {
    throw new Error('Direct labourer requests are disabled. Farmers must post farm work so workers can apply.');
  },

  async findExistingLabourApplication(jobId, labourerId) {
    return Booking.findOne({
      type: 'LABOUR_JOB',
      job_id: jobId,
      labourer_id: labourerId,
      status: { $in: ['PENDING', 'APPROVED', 'ACTIVE'] },
    }).lean();
  },

  async createLabourApplication({ jobId, labourerId, employerId, requiredDate, expectedCost }) {
    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const doc = await Booking.create({
      type: 'LABOUR_JOB',
      job_id: jobId,
      farmer_id: employerId,
      labourer_id: labourerId,
      start_date: requiredDate ? new Date(requiredDate) : null,
      end_date: requiredDate ? new Date(requiredDate) : null,
      total_amount: expectedCost ? Number(expectedCost) : null,
      status: 'PENDING',
      requested_at: now,
      response_deadline: deadline,
      is_archived: false,
    });
    return doc._id.toString();
  },

  async hasOverlap(equipmentId, startDate, endDate) {
    // Original: NOT (end_date < startDate OR start_date > endDate)
    // Equivalent: end_date >= startDate AND start_date <= endDate
    const count = await Booking.countDocuments({
      equipment_id: equipmentId,
      status: { $in: ['PENDING', 'APPROVED', 'ACTIVE'] },
      end_date: { $gte: new Date(startDate) },
      start_date: { $lte: new Date(endDate) },
    });
    return count > 0;
  },

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    await this.autoExpireAndArchive();
    const doc = await populateBooking(Booking.findById(id));
    return flattenBooking(doc);
  },

  async findByUser(userId, { type, includeArchived = false } = {}) {
    await this.autoExpireAndArchive();
    const filter = {
      $or: [{ farmer_id: userId }, { owner_id: userId }, { labourer_id: userId }],
    };
    if (type) filter.type = type === 'LABOUR' ? 'LABOUR_JOB' : 'EQUIPMENT_RENTAL';
    if (!includeArchived) filter.is_archived = { $ne: true };

    const docs = await populateBooking(Booking.find(filter)).sort({ created_at: -1 });
    return docs.map(flattenBooking);
  },

  async findForOwner(ownerId, { status, includeArchived = false } = {}) {
    await this.autoExpireAndArchive();
    const filter = { owner_id: ownerId };
    if (status) filter.status = status;
    if (!includeArchived) filter.is_archived = { $ne: true };

    const docs = await populateBooking(Booking.find(filter)).sort({ created_at: -1 });
    const rows = docs.map(flattenBooking);
    return attachRenterInfo(rows);
  },

  async findForLabourer(labourerId, { status, includeArchived = false } = {}) {
    await this.autoExpireAndArchive();
    const filter = { labourer_id: labourerId, type: 'LABOUR_JOB' };
    if (status) filter.status = status;
    if (!includeArchived) filter.is_archived = { $ne: true };

    const docs = await populateBooking(Booking.find(filter)).sort({ created_at: -1 });
    const rows = docs.map(flattenBooking);
    return attachRenterInfo(rows);
  },

  async updateStatus(id, status, extra = {}) {
    const update = { status, ...extra };
    const now = new Date();
    if (status === 'COMPLETED' && !update.completed_at) update.completed_at = now;
    if (status === 'REJECTED' && !update.rejected_at) update.rejected_at = now;
    if (status === 'EXPIRED' && !update.expires_at) update.expires_at = now;
    await Booking.findByIdAndUpdate(id, update);
  },

  async setHandover(id, { condition, fuelLevel }) {
    await Booking.findByIdAndUpdate(id, {
      status: 'ACTIVE',
      handover_date: new Date(),
      condition: condition || null,
      fuel_level: fuelLevel || null,
    });
  },

  async setReturned(id) {
    const now = new Date();
    await Booking.findByIdAndUpdate(id, {
      status: 'COMPLETED',
      actual_return_date: now,
      completed_at: now,
    });
  },

  async searchAdmin({ search }) {
    const filter = {};
    if (search) {
      // farmer full_name / equipment_type live on referenced documents, so
      // a direct regex match on Booking fields won't reach them. Resolve
      // matching Users/Equipment ids first, then match on the booking's FKs
      // -- equivalent to the SQL's `farmer.full_name LIKE ?` / `e.equipment_type LIKE ?`.
      const User = mongoose.model('User');
      const Equipment = mongoose.model('Equipment');
      const regex = new RegExp(search, 'i');

      const [matchingFarmers, matchingEquipment] = await Promise.all([
        User.find({ full_name: regex }, '_id').lean(),
        Equipment.find({ equipment_type: regex }, '_id').lean(),
      ]);

      const idOr = [];
      if (mongoose.isValidObjectId(search)) idOr.push({ _id: search });
      if (matchingFarmers.length) idOr.push({ farmer_id: { $in: matchingFarmers.map((f) => f._id) } });
      if (matchingEquipment.length) idOr.push({ equipment_id: { $in: matchingEquipment.map((e) => e._id) } });

      filter.$or = idOr.length ? idOr : [{ _id: null }]; // no matches -> empty result set
    }

    const docs = await populateBooking(Booking.find(filter)).sort({ created_at: -1 }).limit(200);
    return docs.map(flattenBooking);
  },

  async countAll() {
    return Booking.countDocuments({});
  },

  async trustStatsForUser(userId) {
    const orFilter = { $or: [{ owner_id: userId }, { farmer_id: userId }] };

    const completedRentals = await Booking.countDocuments({ ...orFilter, status: 'COMPLETED' });

    // Date-only comparison (actual_return_date <= expected_return_date,
    // ignoring time-of-day) -- computed in JS for clarity on a dataset
    // this small, matching the "keep it a simple mini project" scope.
    const completedDocs = await Booking.find(
      { ...orFilter, status: 'COMPLETED', actual_return_date: { $ne: null }, expected_return_date: { $ne: null } },
      'actual_return_date expected_return_date'
    ).lean();
    const onTimeReturns = completedDocs.filter((b) => {
      const actualDate = new Date(b.actual_return_date).toISOString().slice(0, 10);
      const expectedDate = new Date(b.expected_return_date).toISOString().slice(0, 10);
      return actualDate <= expectedDate;
    }).length;

    const bookingIds = await Booking.find(orFilter, '_id').lean();
    const Dispute = mongoose.model('Dispute');
    const disputes = await Dispute.countDocuments({ booking_id: { $in: bookingIds.map((b) => b._id) } });

    return { completedRentals, onTimeReturns, disputes };
  },
};

module.exports = bookingModel;
