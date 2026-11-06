const bookingModel = require('../models/bookingModel');
const equipmentModel = require('../models/equipmentModel');
const kycModel = require('../models/kycModel');
const disputeModel = require('../models/disputeModel');
const notificationModel = require('../models/notificationModel');
const AppError = require('../utils/AppError');

function formatBooking(row) {
  const isLabour = row.type === 'LABOUR_JOB';
  return {
    id: row.id,
    type: row.type,
    equipmentId: row.equipment_id,
    jobId: row.job_id,
    equipmentName: row.equipment_type
      ? `${row.equipment_type}${row.brand ? ' - ' + row.brand : ''}`
      : (row.job_work_type || (isLabour ? 'Farm Work' : null)),
    workType: row.job_work_type || (isLabour ? 'Farm Work' : null),
    ownerName: row.owner_name || null,
    farmerName: row.farmer_name || null,
    renterName: row.renter_name || row.farmer_name || null,
    labourerName: row.labourer_name || null,
    startDate: row.start_date || (isLabour ? row.job_required_date : null),
    endDate: row.end_date || (isLabour ? row.job_required_date : null),
    amount: row.total_amount ?? (isLabour ? row.job_expected_cost : null),
    status: row.status,
    condition: row.condition,
    expectedReturnDate: row.expected_return_date,
    bookingDate: row.created_at,
    requestedAt: row.requested_at || row.created_at,
    responseDeadline: row.response_deadline || (row.created_at ? new Date(new Date(row.created_at).getTime() + 48 * 60 * 60 * 1000) : null),
    completedAt: row.completed_at || (row.status === 'COMPLETED' ? row.actual_return_date || row.updated_at : null),
    rejectedAt: row.rejected_at || (row.status === 'REJECTED' ? row.updated_at : null),
    expiresAt: row.expires_at || (row.status === 'EXPIRED' ? row.updated_at : null),
    isArchived: Boolean(row.is_archived),
    renterPhotoUrl: row.renter_photo || null,
    renterVerified: Boolean(row.renter_verified),
    renterTrustScore: null,
    landSize: row.job_land_size || null,
    location: row.job_location || null,
    jobDescription: row.job_description || null,
  };
}

const bookingService = {
  async createBooking(farmerId, { equipmentId, startDate, endDate, totalAmount }) {
    const equipment = await equipmentModel.findById(equipmentId);
    if (!equipment) throw new AppError('Equipment not found.', 404);
    if (equipment.status !== 'APPROVED') throw new AppError('This equipment is not currently available for booking.', 400);
    if (equipment.availability !== 'Available') throw new AppError('This equipment is currently unavailable.', 400);

    const kyc = await kycModel.findByUserId(farmerId);
    if (kyc.status !== 'APPROVED') throw new AppError('Your KYC must be approved before you can book equipment.', 403);

    if (new Date(endDate) < new Date(startDate)) throw new AppError('End date cannot be before start date.', 422);

    const overlap = await bookingModel.hasOverlap(equipmentId, startDate, endDate);
    if (overlap) throw new AppError('This equipment is already booked for the selected dates.', 409);

    const bookingId = await bookingModel.createEquipmentBooking({
      equipmentId, farmerId, ownerId: equipment.owner_id, startDate, endDate, totalAmount,
    });

    await notificationModel.create(equipment.owner_id, {
      type: 'BOOKING_REQUEST',
      title: 'New Booking Request',
      message: `You have a new rental request for your ${equipment.equipment_type}.`,
    });

    return bookingModel.findById(bookingId).then(formatBooking);
  },

  async createLabourBooking() {
    throw new AppError('Direct labourer requests are disabled. Farmers must post farm work so workers can apply.', 400);
  },

  async getMyBookings(userId, filters) {
    const rows = await bookingModel.findByUser(userId, filters);
    return rows.map(formatBooking);
  },

  async getById(id, userId) {
    const row = await bookingModel.findById(id);
    if (!row) throw new AppError('Booking not found.', 404);
    const isParty = [row.farmer_id, row.owner_id, row.labourer_id].includes(userId);
    if (!isParty) throw new AppError('You do not have permission to view this booking.', 403);
    return formatBooking(row);
  },

  async getRentalRequestsForOwner(ownerId, statusFilter = null) {
    const filterOpts = statusFilter ? { status: statusFilter } : {};
    const rows = await bookingModel.findForOwner(ownerId, filterOpts);
    return rows.map((r) => ({
      id: r.id,
      equipmentName: `${r.equipment_type || 'Equipment'}${r.brand ? ' - ' + r.brand : ''}`,
      farmerName: r.renter_name || r.farmer_name,
      renterName: r.renter_name || r.farmer_name,
      renterPhotoUrl: r.renter_photo,
      renterVerified: Boolean(r.renter_verified),
      renterTrustScore: null,
      bookingDate: r.created_at,
      startDate: r.start_date,
      endDate: r.end_date,
      amount: r.total_amount,
      totalPrice: r.total_amount,
      status: r.status,
    }));
  },

  async getJobRequestsForLabour(labourerId, statusFilter = null) {
    const filterOpts = statusFilter ? { status: statusFilter } : {};
    const rows = await bookingModel.findForLabourer(labourerId, filterOpts);
    return rows.map((r) => ({
      id: r.id,
      workType: r.job_work_type || 'Labour Service',
      farmerName: r.renter_name || r.farmer_name,
      renterName: r.renter_name || r.farmer_name,
      renterPhotoUrl: r.renter_photo,
      renterVerified: Boolean(r.renter_verified),
      renterTrustScore: null,
      bookingDate: r.created_at,
      startDate: r.start_date || r.job_required_date,
      endDate: r.end_date || r.job_required_date,
      amount: r.total_amount ?? r.job_expected_cost,
      totalPrice: r.total_amount ?? r.job_expected_cost,
      status: r.status,
      landSize: r.job_land_size || null,
      location: r.job_location || null,
      description: r.job_description || null,
    }));
  },

  async accept(id, userId) {
    const booking = await bookingModel.findById(id);
    if (!booking) throw new AppError('Booking not found.', 404);

    const isAuthorized =
      booking.owner_id === userId ||
      booking.labourer_id === userId ||
      booking.farmer_id === userId;

    if (!isAuthorized) throw new AppError('You do not have permission to modify this booking.', 403);
    if (booking.status !== 'PENDING') throw new AppError('This booking has already been processed.', 400);

    // Deadline check (2 days)
    const now = new Date();
    if (booking.response_deadline && now > new Date(booking.response_deadline)) {
      await bookingModel.updateStatus(id, 'EXPIRED', { expires_at: now });
      throw new AppError('This request has expired (2-day response deadline passed) and cannot be accepted.', 400);
    }

    if (booking.job_id) {
      const labourModel = require('../models/labourModel');
      const mongoose = require('mongoose');
      const Booking = mongoose.model('Booking');

      // Atomic lock: Only transition if status is currently OPEN or PENDING
      const updatedJob = await labourModel.atomicAcceptJob(booking.job_id, booking.labourer_id);
      if (!updatedJob) {
        throw new AppError('This farm work has already been assigned to another labourer.', 400);
      }

      // Mark this booking APPROVED
      await bookingModel.updateStatus(id, 'APPROVED');

      // Automatically reject any other pending applications for this job
      const otherPending = await Booking.find({
        job_id: booking.job_id,
        _id: { $ne: booking.id },
        status: 'PENDING',
      }).select('_id labourer_id').lean();

      if (otherPending.length > 0) {
        const otherIds = otherPending.map((b) => b._id);
        await Booking.updateMany(
          { _id: { $in: otherIds } },
          { $set: { status: 'REJECTED', rejected_at: now } }
        );

        for (const other of otherPending) {
          if (other.labourer_id) {
            await notificationModel.create(other.labourer_id, {
              type: 'BOOKING_STATUS',
              title: 'Farm Work Position Filled',
              message: 'This farm work post has been assigned to another applicant.',
            }).catch(() => {});
          }
        }
      }
    } else {
      await bookingModel.updateStatus(id, 'APPROVED');
    }

    const recipientId = userId === booking.farmer_id ? (booking.labourer_id || booking.owner_id) : booking.farmer_id;
    if (recipientId) {
      await notificationModel.create(recipientId, {
        type: 'BOOKING_STATUS',
        title: 'Booking Accepted',
        message: 'Your booking request has been accepted.',
      }).catch(() => {});
    }
  },

  async reject(id, userId) {
    const booking = await bookingModel.findById(id);
    if (!booking) throw new AppError('Booking not found.', 404);

    const isAuthorized =
      booking.owner_id === userId ||
      booking.labourer_id === userId ||
      booking.farmer_id === userId;

    if (!isAuthorized) throw new AppError('You do not have permission to modify this booking.', 403);
    if (booking.status !== 'PENDING') throw new AppError('This booking has already been processed.', 400);

    const now = new Date();
    await bookingModel.updateStatus(id, 'REJECTED', { rejected_at: now });

    if (booking.job_id) {
      const labourModel = require('../models/labourModel');
      const mongoose = require('mongoose');
      const Booking = mongoose.model('Booking');

      // If no other booking is currently approved/active for this job, ensure job remains OPEN for other labourers!
      const activeBooking = await Booking.exists({
        job_id: booking.job_id,
        status: { $in: ['APPROVED', 'ACTIVE', 'BOOKED'] },
      });

      if (!activeBooking) {
        await labourModel.updateJobStatus(booking.job_id, 'OPEN');
      }
    }

    const recipientId = userId === booking.farmer_id ? (booking.labourer_id || booking.owner_id) : booking.farmer_id;
    if (recipientId) {
      await notificationModel.create(recipientId, {
        type: 'BOOKING_STATUS',
        title: 'Booking Rejected',
        message: 'Your booking request was rejected.',
      }).catch(() => {});
    }
  },

  async cancel(id, userId) {
    const booking = await bookingModel.findById(id);
    if (!booking) throw new AppError('Booking not found.', 404);
    if (![booking.farmer_id, booking.owner_id, booking.labourer_id].includes(userId)) throw new AppError('You do not have permission to cancel this booking.', 403);
    if (!['PENDING', 'APPROVED'].includes(booking.status)) throw new AppError('This booking can no longer be cancelled.', 400);
    await bookingModel.updateStatus(id, 'CANCELLED');
    if (booking.job_id) {
      const labourModel = require('../models/labourModel');
      const mongoose = require('mongoose');
      const Booking = mongoose.model('Booking');
      const activeBooking = await Booking.exists({
        job_id: booking.job_id,
        _id: { $ne: booking.id },
        status: { $in: ['APPROVED', 'ACTIVE', 'BOOKED'] },
      });
      if (!activeBooking) {
        await labourModel.updateJobStatus(booking.job_id, 'OPEN');
      }
    }
  },

  async confirmHandover(id, userId, { condition, fuelLevel } = {}) {
    const booking = await bookingModel.findById(id);
    if (!booking) throw new AppError('Booking not found.', 404);
    if (![booking.farmer_id, booking.owner_id].includes(userId)) throw new AppError('You do not have permission to confirm this handover.', 403);
    if (booking.status !== 'APPROVED') throw new AppError('This booking is not ready for handover.', 400);
    await bookingModel.setHandover(id, { condition, fuelLevel });
  },

  async confirmReturn(id, userId) {
    const booking = await bookingModel.findById(id);
    if (!booking) throw new AppError('Booking not found.', 404);
    if (![booking.farmer_id, booking.owner_id, booking.labourer_id].includes(userId)) throw new AppError('You do not have permission to mark this work as completed.', 403);
    
    // For equipment rental, must be ACTIVE. For labour job, APPROVED or ACTIVE.
    if (booking.type === 'LABOUR_JOB') {
      if (!['APPROVED', 'ACTIVE', 'PENDING'].includes(booking.status)) throw new AppError('This work booking cannot be completed.', 400);
    } else {
      if (booking.status !== 'ACTIVE') throw new AppError('This booking is not currently active.', 400);
    }

    await bookingModel.setReturned(id);

    if (booking.job_id) {
      const labourModel = require('../models/labourModel');
      await labourModel.updateJobStatus(booking.job_id, 'COMPLETED', { completed_at: new Date() });
    }

    const recipientId = userId === booking.farmer_id ? booking.labourer_id : booking.farmer_id;
    if (recipientId) {
      await notificationModel.create(recipientId, {
        type: 'BOOKING_STATUS',
        title: 'Work Completed',
        message: 'The farm work has been marked as completed.',
      }).catch(() => {});
    }
  },

  async reportIssue(id, userId, { issue, description }) {
    const booking = await bookingModel.findById(id);
    if (!booking) throw new AppError('Booking not found.', 404);
    if (![booking.farmer_id, booking.owner_id].includes(userId)) throw new AppError('You do not have permission to report an issue for this booking.', 403);
    await disputeModel.create({ bookingId: id, raisedBy: userId, issue, description });
    await bookingModel.updateStatus(id, 'DISPUTED');
  },

  async searchForAdmin(filters) {
    const rows = await bookingModel.searchAdmin(filters);
    return rows.map((r) => ({
      id: r.id, farmerName: r.farmer_name, ownerName: r.owner_name, equipmentName: r.equipment_type,
      startDate: r.start_date, endDate: r.end_date, amount: r.total_amount, status: r.status,
    }));
  },
};

module.exports = bookingService;