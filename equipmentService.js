const equipmentModel = require('../models/equipmentModel');
const notificationModel = require('../models/notificationModel');
const AppError = require('../utils/AppError');

function formatEquipment(row) {
  return {
    id: row.id,
    equipmentType: row.equipment_type,
    name: `${row.equipment_type}${row.brand ? ' - ' + row.brand : ''}`,
    brand: row.brand,
    model: row.model,
    yearOfPurchase: row.year_of_purchase,
    pricePerHour: row.price_per_hour,
    pricePerDay: row.price_per_day,
    serviceArea: row.service_area,
    district: row.district,
    condition: row.condition,
    availability: row.availability,
    approvalStatus: row.status,
    rejectionReason: row.rejection_reason,
    photoUrl: row.photo || null,
    ownerName: row.owner_name,
    ownerVerified: Boolean(row.owner_verified),
    rating: row.avg_rating != null ? Number(row.avg_rating) : null,
  };
}

const equipmentService = {
  async addEquipment(ownerId, fields, files) {
    const equipmentId = await equipmentModel.create(ownerId, {
      equipmentType: fields.equipmentType,
      brand: fields.brand,
      model: fields.model,
      yearOfPurchase: fields.yearOfPurchase ? Number(fields.yearOfPurchase) : null,
      pricePerHour: Number(fields.pricePerHour),
      pricePerDay: Number(fields.pricePerDay),
      serviceArea: fields.serviceArea,
      district: fields.district || fields.serviceArea,
      condition: (fields.condition || 'GOOD').toUpperCase(),
      availability: fields.availability || 'Available',
      ownershipProof: files?.ownershipProof?.[0] ? `/uploads/ownership/${files.ownershipProof[0].filename}` : null,
    });

    const photoPaths = (files?.photos || []).map((f) => `/uploads/equipment/${f.filename}`);
    await equipmentModel.addImages(equipmentId, photoPaths);

    return equipmentModel.findById(equipmentId).then(formatEquipment);
  },

  async getMyEquipment(ownerId) {
    const rows = await equipmentModel.findByOwner(ownerId);
    return rows.map(formatEquipment);
  },

  async getById(id) {
    const row = await equipmentModel.findById(id);
    if (!row) throw new AppError('Equipment not found.', 404);
    return { ...formatEquipment(row), photos: row.images, ownerPhotoUrl: row.owner_photo, ownerRating: null };
  },

  async update(id, ownerId, fields) {
    const owned = await equipmentModel.isOwnedBy(id, ownerId);
    if (!owned) throw new AppError('You do not have permission to edit this equipment.', 403);
    await equipmentModel.update(id, ownerId, fields);
  },

  async delete(id, ownerId) {
    const owned = await equipmentModel.isOwnedBy(id, ownerId);
    if (!owned) throw new AppError('You do not have permission to delete this equipment.', 403);
    await equipmentModel.delete(id, ownerId);
  },

  async search(filters) {
    const rows = await equipmentModel.search(filters);
    return rows.map(formatEquipment);
  },

  async forAdminReview() {
    const rows = await equipmentModel.forAdminReview({ status: 'PENDING' });
    return rows.map((r) => ({
      id: r.id,
      name: `${r.equipment_type}${r.brand ? ' - ' + r.brand : ''}`,
      ownerName: r.owner_name,
      equipmentType: r.equipment_type,
      district: r.district,
      pricePerDay: r.price_per_day,
      approvalStatus: r.status,
    }));
  },

  async approve(id) {
    await equipmentModel.setApprovalStatus(id, 'APPROVED');
    const equipment = await equipmentModel.findById(id);
    await notificationModel.create(equipment.owner_id, {
      type: 'EQUIPMENT_APPROVAL',
      title: 'Equipment Approved',
      message: `Your ${equipment.equipment_type} listing has been approved and is now visible to farmers.`,
    });
  },

  async reject(id, reason) {
    if (!reason || !reason.trim()) throw new AppError('A rejection reason is required.', 422);
    await equipmentModel.setApprovalStatus(id, 'REJECTED', reason.trim());
    const equipment = await equipmentModel.findById(id);
    await notificationModel.create(equipment.owner_id, {
      type: 'EQUIPMENT_APPROVAL',
      title: 'Equipment Rejected',
      message: `Your ${equipment.equipment_type} listing was rejected: ${reason.trim()}`,
    });
  },
};

module.exports = equipmentService;