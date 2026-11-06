const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', adminController.login);

router.use(protect, requireRole('ADMIN'));

router.get('/dashboard', adminController.dashboard);

router.get('/users', adminController.getUsers);
router.put('/users/:id/activate', adminController.activateUser);
router.put('/users/:id/deactivate', adminController.deactivateUser);
router.put('/users/:id/suspend', adminController.suspendUser);

router.get('/kyc', adminController.getPendingKyc);
router.put('/kyc/:id/approve', adminController.approveKyc);
router.put('/kyc/:id/reject', adminController.rejectKyc);

router.get('/equipment', adminController.getEquipmentForReview);
router.put('/equipment/:id/approve', adminController.approveEquipment);
router.put('/equipment/:id/reject', adminController.rejectEquipment);

router.get('/bookings', adminController.getBookings);

router.get('/disputes', adminController.getDisputes);
router.put('/disputes/:id/in-review', adminController.markDisputeInReview);
router.put('/disputes/:id/resolve', adminController.resolveDispute);

module.exports = router;