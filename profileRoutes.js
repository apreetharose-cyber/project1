const express = require('express');
const profileController = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const { profileUploadFields } = require('../utils/upload');

const router = express.Router();

router.get('/', protect, profileController.getProfile);
router.put('/', protect, profileUploadFields, profileController.updateProfile);

module.exports = router;