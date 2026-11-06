const mongoose = require('mongoose');
require('./userModel');
require('./profileModel');
require('./kycModel');

const equipmentSchema = new mongoose.Schema(
  {
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    equipment_type: { type: String, required: true },
    brand: { type: String, default: null },
    model: { type: String, default: null },
    year_of_purchase: { type: Number, default: null },
    price_per_hour: { type: Number, required: true },
    price_per_day: { type: Number, required: true },
    service_area: { type: String, default: null },
    district: { type: String, default: null },
    condition: { type: String, enum: ['NEW', 'GOOD', 'AVERAGE'], required: true, default: 'GOOD' },
    availability: { type: String, enum: ['Available', 'Unavailable', 'Maintenance', 'Rented'], required: true, default: 'Available' },
    ownership_proof: { type: String, default: null },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], required: true, default: 'PENDING' },
    rejection_reason: { type: String, default: null },
    // The old `equipment_images` table is embedded here as a plain array --
    // MongoDB-idiomatic for a one-to-many "just a list of paths" relationship
    // that was only ever queried alongside its parent equipment record.
    images: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

equipmentSchema.index({ status: 1 });
equipmentSchema.index({ equipment_type: 1 });
equipmentSchema.index({ district: 1 });
equipmentSchema.index({ price_per_day: 1 });

const Equipment = mongoose.model('Equipment', equipmentSchema);

// Shared aggregation stage: computes each equipment's average rating from
// the `ratings` collection, replacing the SQL correlated subquery
// `(SELECT AVG(stars) FROM ratings WHERE equipment_id = e.id)`.
function withAvgRatingLookup() {
  return [
    {
      $lookup: {
        from: 'ratings',
        localField: '_id',
        foreignField: 'equipment_id',
        as: '_ratings',
      },
    },
    {
      $addFields: {
        avg_rating: {
          $cond: [
            { $and: [{ $isArray: '$_ratings' }, { $gt: [{ $size: '$_ratings' }, 0] }] },
            { $avg: '$_ratings.stars' },
            null,
          ],
        },
      },
    },
    { $project: { _ratings: 0 } },
  ];
}

function withOwnerLookup() {
  return [
    {
      $lookup: {
        from: 'users',
        localField: 'owner_id',
        foreignField: '_id',
        as: '_owner',
      },
    },
    { $unwind: { path: '$_owner', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'kycs',
        localField: 'owner_id',
        foreignField: 'user_id',
        as: '_kyc',
      },
    },
    {
      $addFields: {
        owner_name: '$_owner.full_name',
        owner_verified: {
          $eq: [
            {
              $cond: [
                { $isArray: '$_kyc' },
                { $ifNull: [{ $arrayElemAt: ['$_kyc.status', 0] }, 'NOT_SUBMITTED'] },
                'NOT_SUBMITTED',
              ],
            },
            'APPROVED',
          ],
        },
      },
    },
    { $project: { _owner: 0, _kyc: 0 } },
  ];
}

// Normalizes an aggregation result (or a populated doc) into the exact flat
// "row" shape equipmentService.js already expects (row.id, row.photo,
// row.owner_name, row.avg_rating, etc.) so the service layer needs zero changes.
function toRow(doc) {
  if (!doc) return null;
  return {
    ...doc,
    id: doc._id.toString(),
    owner_id: doc.owner_id?._id ? doc.owner_id._id.toString() : doc.owner_id?.toString(),
    photo: doc.images && doc.images.length > 0 ? doc.images[0] : null,
    avg_rating: doc.avg_rating != null ? doc.avg_rating : null,
  };
}

const equipmentModel = {
  async create(ownerId, data) {
    const doc = await Equipment.create({
      owner_id: ownerId,
      equipment_type: data.equipmentType,
      brand: data.brand || null,
      model: data.model || null,
      year_of_purchase: data.yearOfPurchase || null,
      price_per_hour: data.pricePerHour,
      price_per_day: data.pricePerDay,
      service_area: data.serviceArea || null,
      district: data.district || null,
      condition: data.condition,
      availability: data.availability || 'Available',
      ownership_proof: data.ownershipProof || null,
      status: 'PENDING',
    });
    return doc.id;
  },

  async addImages(equipmentId, imagePaths) {
    if (!imagePaths.length) return;
    await Equipment.findByIdAndUpdate(equipmentId, { $push: { images: { $each: imagePaths } } });
  },

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;

    const results = await Equipment.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      ...withOwnerLookup(),
      ...withAvgRatingLookup(),
      {
        $lookup: {
          from: 'profiles',
          localField: 'owner_id',
          foreignField: 'user_id',
          as: '_ownerProfile',
        },
      },
      {
        $addFields: {
          owner_photo: { $arrayElemAt: ['$_ownerProfile.profile_photo', 0] },
          owner_district: { $arrayElemAt: ['$_ownerProfile.district', 0] },
        },
      },
      { $project: { _ownerProfile: 0 } },
    ]);

    return results[0] ? toRow(results[0]) : null;
  },

  async findByOwner(ownerId) {
    const docs = await Equipment.find({ owner_id: ownerId }).sort({ created_at: -1 }).lean();
    return docs.map(toRow);
  },

  async update(id, ownerId, data) {
    const allowed = {
      equipmentType: 'equipment_type', brand: 'brand', model: 'model',
      yearOfPurchase: 'year_of_purchase', pricePerHour: 'price_per_hour',
      pricePerDay: 'price_per_day', serviceArea: 'service_area', district: 'district',
      condition: 'condition', availability: 'availability',
    };
    const update = {};
    Object.entries(allowed).forEach(([key, field]) => {
      if (data[key] !== undefined) update[field] = data[key];
    });
    if (Object.keys(update).length === 0) return false;

    const result = await Equipment.updateOne({ _id: id, owner_id: ownerId }, { $set: update });
    return result.matchedCount > 0;
  },

  async delete(id, ownerId) {
    const result = await Equipment.deleteOne({ _id: id, owner_id: ownerId });
    return result.deletedCount > 0;
  },

  async isOwnedBy(id, ownerId) {
    if (!mongoose.isValidObjectId(id)) return false;
    const doc = await Equipment.findOne({ _id: id, owner_id: ownerId }, '_id').lean();
    return Boolean(doc);
  },

  async search({ equipmentType, district, minPrice, maxPrice, rating }) {
    const match = { status: 'APPROVED' };
    if (equipmentType) match.equipment_type = equipmentType;
    if (district) {
      const regex = new RegExp(district, 'i');
      match.$or = [{ district: regex }, { service_area: regex }];
    }
    if (minPrice || maxPrice) {
      match.price_per_day = {};
      if (minPrice) match.price_per_day.$gte = Number(minPrice);
      if (maxPrice) match.price_per_day.$lte = Number(maxPrice);
    }

    const results = await Equipment.aggregate([
      { $match: match },
      ...withOwnerLookup(),
      ...withAvgRatingLookup(),
      { $sort: { created_at: -1 } },
    ]);

    const rows = results.map(toRow);
    return rating ? rows.filter((r) => (r.avg_rating || 0) >= Number(rating)) : rows;
  },

  async allApprovedForRecommendation() {
    const results = await Equipment.aggregate([
      { $match: { status: 'APPROVED', availability: 'Available' } },
      ...withAvgRatingLookup(),
    ]);
    return results.map(toRow);
  },

  async forAdminReview(filters = {}) {
    const match = {};
    if (filters.status) match.status = filters.status;

    const results = await Equipment.aggregate([
      { $match: match },
      ...withOwnerLookup(),
      { $sort: { created_at: -1 } },
    ]);
    return results.map(toRow);
  },

  async setApprovalStatus(id, status, reason = null) {
    await Equipment.findByIdAndUpdate(id, { status, rejection_reason: reason });
  },

  async countApproved() {
    return Equipment.countDocuments({ status: 'APPROVED' });
  },

  async countAll() {
    return Equipment.countDocuments({});
  },
};

module.exports = equipmentModel;
