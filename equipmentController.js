const equipmentService = require('../services/equipmentService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const equipmentController = {
  create: asyncHandler(async (req, res) => {
    const equipment = await equipmentService.addEquipment(req.user.id, req.body, req.files);
    res.status(201).json({ success: true, message: 'Equipment submitted for approval.', equipment });
  }),

  getMine: asyncHandler(async (req, res) => {
    if (req.query.mine !== 'true') throw new AppError('Unsupported query.', 400);
    const equipment = await equipmentService.getMyEquipment(req.user.id);
    res.json({ equipment });
  }),

  getById: asyncHandler(async (req, res) => {
    const equipment = await equipmentService.getById(req.params.id);
    res.json({ equipment });
  }),

  update: asyncHandler(async (req, res) => {
    await equipmentService.update(req.params.id, req.user.id, req.body);
    res.json({ success: true, message: 'Equipment updated successfully.' });
  }),

  remove: asyncHandler(async (req, res) => {
    await equipmentService.delete(req.params.id, req.user.id);
    res.json({ success: true, message: 'Equipment removed successfully.' });
  }),

  search: asyncHandler(async (req, res) => {
    const equipment = await equipmentService.search(req.query);
    res.json({ equipment });
  }),
};

module.exports = equipmentController;