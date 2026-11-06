const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const kycController = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'profiles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const uploadDoc = multer({ storage }).fields([{ name: 'document', maxCount: 1 }]);

router.get('/status', protect, kycController.getStatus);
router.post('/', protect, uploadDoc, kycController.submit);
router.put('/resubmit', protect, uploadDoc, kycController.resubmit);

module.exports = router;