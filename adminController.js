const adminService = require('../services/adminService');
const kycService = require('../services/kycService');
const equipmentService = require('../services/equipmentService');
const bookingService = require('../services/bookingService');
const disputeService = require('../services/disputeService');
const asyncHandler = require('../utils/asyncHandler');

const adminController = {
  login: asyncHandler(async (req, res) => { const { email, password } = req.body; const result = await adminService.login(email, password); res.json({ success: true, message: 'Login successful', ...result }); }),

  dashboard: asyncHandler(async (req, res) => { const stats = await adminService.getDashboardStats(); res.json({ stats }); }),

  getUsers: asyncHandler(async (req, res) => { const users = await adminService.getUsers(req.query); res.json({ users }); }),
  activateUser: asyncHandler(async (req, res) => { await adminService.setAccountStatus(req.params.id, 'ACTIVE'); res.json({ success: true, message: 'User activated.' }); }),
  deactivateUser: asyncHandler(async (req, res) => { await adminService.setAccountStatus(req.params.id, 'INACTIVE'); res.json({ success: true, message: 'User deactivated.' }); }),
  suspendUser: asyncHandler(async (req, res) => { await adminService.setAccountStatus(req.params.id, 'SUSPENDED'); res.json({ success: true, message: 'User suspended.' }); }),

  getPendingKyc: asyncHandler(async (req, res) => { const kycRequests = await kycService.listPending(); res.json({ kycRequests }); }),
  approveKyc: asyncHandler(async (req, res) => { await kycService.approve(req.params.id, req.user.id); res.json({ success: true, message: 'KYC approved.' }); }),
  rejectKyc: asyncHandler(async (req, res) => { await kycService.reject(req.params.id, req.user.id, req.body.reason); res.json({ success: true, message: 'KYC rejected.' }); }),

  getEquipmentForReview: asyncHandler(async (req, res) => { const equipment = await equipmentService.forAdminReview(); res.json({ equipment }); }),
  approveEquipment: asyncHandler(async (req, res) => { await equipmentService.approve(req.params.id); res.json({ success: true, message: 'Equipment approved.' }); }),
  rejectEquipment: asyncHandler(async (req, res) => { await equipmentService.reject(req.params.id, req.body.reason); res.json({ success: true, message: 'Equipment rejected.' }); }),

  getBookings: asyncHandler(async (req, res) => { const bookings = await bookingService.searchForAdmin(req.query); res.json({ bookings }); }),

  getDisputes: asyncHandler(async (req, res) => { const disputes = await disputeService.getAllForAdmin(); res.json({ disputes }); }),
  markDisputeInReview: asyncHandler(async (req, res) => { await disputeService.markInReview(req.params.id); res.json({ success: true, message: 'Dispute marked as in review.' }); }),
  resolveDispute: asyncHandler(async (req, res) => { await disputeService.resolve(req.params.id); res.json({ success: true, message: 'Dispute resolved.' }); }),
};

module.exports = adminController;