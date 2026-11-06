const express = require('express');
const labourController = require('../controllers/labourController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/jobs', protect, labourController.createJob);
router.get('/jobs', protect, labourController.searchJobs);
router.get('/my-posts', protect, labourController.getMyPosts);
router.get('/search', protect, labourController.searchJobs);

module.exports = router;