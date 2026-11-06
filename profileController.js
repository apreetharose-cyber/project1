const profileService = require('../services/profileService');
const labourService = require('../services/labourService');
const asyncHandler = require('../utils/asyncHandler');

const profileController = {
  getProfile: asyncHandler(async (req, res) => {
    const data = await profileService.getFullProfile(req.user.id);
    res.json(data);
  }),

  updateProfile: asyncHandler(async (req, res) => {
    // Multiplexed endpoint: basic profile fields + role assignment, and
    // (when labour-specific fields are present) the labour work profile —
    // see Step 1 mapping notes B and C.
    await profileService.updateProfile(req.user.id, req.body, req.files);

    if (req.body.typeOfWork) {
      await labourService.updateWorkProfile(req.user.id, req.body, req.files);
    }

    const data = await profileService.getFullProfile(req.user.id);
    res.json({ success: true, message: 'Profile updated successfully.', profile: data.profile });
  }),
};

module.exports = profileController;