const labourService = require('../services/labourService');
const asyncHandler = require('../utils/asyncHandler');

const labourController = {
  createJob: asyncHandler(async (req, res) => {
    const job = await labourService.createJob(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Farm work posted successfully!', job });
  }),

  getMyPosts: asyncHandler(async (req, res) => {
    const jobs = await labourService.getMyPosts(req.user.id);
    res.json({ jobs });
  }),

  searchJobs: asyncHandler(async (req, res) => {
    const jobs = await labourService.searchJobs(req.query);
    res.json({ jobs });
  }),
};

module.exports = labourController;