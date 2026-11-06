const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AppError = require('./AppError');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subfolder = 'profiles';
    if (file.fieldname === 'drivingLicence') subfolder = 'licences';
    if (file.fieldname === 'photos') subfolder = 'equipment';
    if (file.fieldname === 'ownershipProof') subfolder = 'ownership';

    const dir = path.join(__dirname, '..', 'uploads', subfolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['ownershipProof', 'drivingLicence'].includes(file.fieldname)
    ? ALLOWED_DOC_TYPES
    : ALLOWED_IMAGE_TYPES;
  if (!allowed.includes(file.mimetype)) {
    return cb(new AppError('Invalid file type. Executable files are never allowed.', 400));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

const profileUploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'drivingLicence', maxCount: 1 },
]);

const equipmentUploadFields = upload.fields([
  { name: 'photos', maxCount: 8 },
  { name: 'ownershipProof', maxCount: 1 },
]);

module.exports = { profileUploadFields, equipmentUploadFields };