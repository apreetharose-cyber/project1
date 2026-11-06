const express = require('express');
const { body } = require('express-validator');
const equipmentController = require('../controllers/equipmentController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { equipmentUploadFields } = require('../utils/upload');
const validate = require('../middleware/validate');

const router = express.Router();

// /search must be registered before /:id
router.get('/search', protect, equipmentController.search);
router.get('/', protect, equipmentController.getMine);

router.post(
  '/',
  protect,
  requireRole('EQUIPMENT_OWNER'),
  equipmentUploadFields,
  [
    body('equipmentType').notEmpty().withMessage('Equipment type is required.'),
    body('pricePerHour').isFloat({ gt: 0 }).withMessage('Enter a valid hourly price.'),
    body('pricePerDay').isFloat({ gt: 0 }).withMessage('Enter a valid daily price.'),
  ],
  validate,
  equipmentController.create
);

router.get('/:id', protect, equipmentController.getById);
router.put('/:id', protect, requireRole('EQUIPMENT_OWNER'), equipmentController.update);
router.delete('/:id', protect, requireRole('EQUIPMENT_OWNER'), equipmentController.remove);

module.exports = router;