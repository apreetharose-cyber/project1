const bookingService = require('../services/bookingService');
const labourService = require('../services/labourService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const bookingController = {
  create: asyncHandler(async (req, res) => {
    // Labour job application vs. equipment rental
    if (req.body.jobId && req.body.type === 'LABOUR') {
      const bookingId = await labourService.applyToJob(req.body.jobId, req.user.id);
      return res.status(201).json({ success: true, message: 'Application sent!', bookingId });
    }

    if (req.body.labourerId && req.body.type === 'LABOUR') {
      throw new AppError('Direct labourer requests are disabled. Please post farm work so workers can apply.', 400);
    }

    const booking = await bookingService.createBooking(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Your booking request has been sent.', booking });
  }),

  getMine: asyncHandler(async (req, res) => {
    if (req.query.forOwner === 'true') {
      const bookings = await bookingService.getRentalRequestsForOwner(req.user.id, req.query.status);
      return res.json({ bookings });
    }
    if (req.query.forLabour === 'true') {
      const bookings = await bookingService.getJobRequestsForLabour(req.user.id, req.query.status);
      return res.json({ bookings });
    }
    throw new AppError('Unsupported query.', 400);
  }),

  getMy: asyncHandler(async (req, res) => {
    const bookings = await bookingService.getMyBookings(req.user.id, { type: req.query.type });
    res.json({ bookings });
  }),

  getById: asyncHandler(async (req, res) => {
    const booking = await bookingService.getById(req.params.id, req.user.id);
    res.json({ booking });
  }),

  accept: asyncHandler(async (req, res) => { await bookingService.accept(req.params.id, req.user.id); res.json({ success: true, message: 'Booking accepted.' }); }),
  reject: asyncHandler(async (req, res) => { await bookingService.reject(req.params.id, req.user.id); res.json({ success: true, message: 'Booking rejected.' }); }),
  cancel: asyncHandler(async (req, res) => { await bookingService.cancel(req.params.id, req.user.id); res.json({ success: true, message: 'Booking cancelled.' }); }),
  handover: asyncHandler(async (req, res) => { await bookingService.confirmHandover(req.params.id, req.user.id, req.body); res.json({ success: true, message: 'Handover confirmed! The rental is now active.' }); }),
  complete: asyncHandler(async (req, res) => { await bookingService.confirmReturn(req.params.id, req.user.id); res.json({ success: true, message: 'Return confirmed! The rental is now complete.' }); }),
  reportIssue: asyncHandler(async (req, res) => { await bookingService.reportIssue(req.params.id, req.user.id, req.body); res.json({ success: true, message: 'Issue reported. Our team will review it.' }); }),
};

module.exports = bookingController;