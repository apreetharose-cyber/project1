const mongoose = require('mongoose');
require('./userModel');

const labourProfileSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    work_type: {
      type: String,
      enum: ['TRACTOR_DRIVER', 'HARVESTER_OPERATOR', 'FARM_LABOUR', 'IRRIGATION_WORKER', 'SPRAYING_WORKER', 'OTHER'],
      required: true,
    },
    age: { type: Number, default: null },
    years_experience: { type: Number, default: null },
    daily_wage: { type: Number, default: null },
    hourly_wage: { type: Number, default: null },
    available_days: { type: String, default: null }, // comma-separated, e.g. "Mon,Tue,Wed"
    preferred_working_area: { type: String, default: null },
    experience_description: { type: String, default: null },
    driving_licence_path: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

labourProfileSchema.index({ work_type: 1 });

const LabourProfile = mongoose.model('LabourProfile', labourProfileSchema);

const labourJobSchema = new mongoose.Schema(
  {
    posted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    work_type: {
      type: String,
      required: true,
    },
    work_description: { type: String, required: true },
    description: { type: String, default: null },
    land_size: { type: String, required: true },
    location: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location_details: {
      address: { type: String, default: null },
      city: { type: String, default: null },
      district: { type: String, default: null },
      state: { type: String, default: null },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    district: { type: String, default: null },
    state: { type: String, default: null },
    expected_cost: { type: Number, required: true },
    wage: { type: Number, required: true },
    required_date: { type: Date, required: true },
    work_date: { type: Date, default: null },
    additional_requirements: { type: String, default: null },
    accepted_labourer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completed_at: { type: Date, default: null },
    rejected_at: { type: Date, default: null },
    expires_at: { type: Date, default: null },
    is_archived: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['OPEN', 'PENDING', 'BOOKED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CLOSED'],
      required: true,
      default: 'OPEN',
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

labourJobSchema.index({ status: 1 });
labourJobSchema.index({ district: 1 });
labourJobSchema.index({ is_archived: 1 });

const LabourJob = mongoose.model('LabourJob', labourJobSchema);

const labourModel = {
  async createJob(postedBy, data) {
    const cost = Number(data.expectedCost || data.wage || 0);
    const reqDate = data.requiredDate || data.workDate ? new Date(data.requiredDate || data.workDate) : null;
    const lat = data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null;
    const lng = data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null;

    const doc = await LabourJob.create({
      posted_by: postedBy,
      work_type: data.workType,
      work_description: data.workDescription || data.description || '',
      description: data.workDescription || data.description || '',
      land_size: data.landSize || '',
      location: data.location,
      latitude: lat,
      longitude: lng,
      location_details: {
        address: data.address || data.location,
        city: data.city || '',
        district: data.district || '',
        state: data.state || '',
        latitude: lat,
        longitude: lng,
      },
      district: data.district || '',
      state: data.state || '',
      expected_cost: cost,
      wage: cost,
      required_date: reqDate,
      work_date: reqDate,
      additional_requirements: data.additionalRequirements || '',
      status: 'OPEN',
    });
    return doc._id.toString();
  },

  async upsertProfile(userId, data) {
    const update = {
      work_type: data.workType,
      age: data.age || null,
      years_experience: data.yearsExperience || null,
      daily_wage: data.dailyWage || null,
      hourly_wage: data.hourlyWage || null,
      available_days: data.availableDays || null,
      preferred_working_area: data.preferredWorkingArea || null,
      experience_description: data.experienceDescription || null,
    };

    if (data.drivingLicencePath) {
      update.driving_licence_path = data.drivingLicencePath;
    }

    await LabourProfile.findOneAndUpdate(
      { user_id: userId },
      { $set: update, $setOnInsert: { user_id: userId } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  },

  async findByUserId(userId) {
    return LabourProfile.findOne({ user_id: userId }).lean();
  },

  async searchJobs({ workType, district, location, minWage }) {
    const match = { status: 'OPEN', is_archived: { $ne: true } };
    if (workType) {
      match.work_type = new RegExp(workType.replace(/_/g, ' '), 'i');
    }
    const locSearch = location || district;
    if (locSearch) {
      const locRegex = new RegExp(locSearch, 'i');
      match.$or = [{ location: locRegex }, { district: locRegex }, { state: locRegex }];
    }
    if (minWage) {
      match.wage = { $gte: Number(minWage) };
    }

    const jobs = await LabourJob.find(match)
      .sort({ created_at: -1 })
      .populate('posted_by', 'full_name email mobile')
      .lean();

    return jobs.map((j) => ({
      ...j,
      id: j._id.toString(),
      employer_name: j.posted_by?.full_name || 'Farmer',
      posted_by: j.posted_by?._id?.toString(),
      farmer_name: j.posted_by?.full_name || 'Farmer',
      farmer_email: j.posted_by?.email,
      farmer_mobile: j.posted_by?.mobile,
      expected_cost: j.expected_cost || j.wage,
      work_description: j.work_description || j.description,
      required_date: j.required_date || j.work_date,
      latitude: j.latitude || j.location_details?.latitude,
      longitude: j.longitude || j.location_details?.longitude,
      location_details: j.location_details,
      accepted_labourer_id: j.accepted_labourer_id?.toString() || null,
      completed_at: j.completed_at,
      rejected_at: j.rejected_at,
      expires_at: j.expires_at,
    }));
  },

  async getJobsByFarmer(farmerId) {
    const jobs = await LabourJob.find({ posted_by: farmerId, is_archived: { $ne: true } })
      .sort({ created_at: -1 })
      .populate('posted_by', 'full_name email mobile')
      .populate('accepted_labourer_id', 'full_name email mobile')
      .lean();

    return jobs.map((j) => ({
      ...j,
      id: j._id.toString(),
      employer_name: j.posted_by?.full_name || 'Farmer',
      posted_by: j.posted_by?._id?.toString(),
      accepted_labourer_name: j.accepted_labourer_id?.full_name || null,
      accepted_labourer_mobile: j.accepted_labourer_id?.mobile || null,
      expected_cost: j.expected_cost || j.wage,
      work_description: j.work_description || j.description,
      required_date: j.required_date || j.work_date,
      latitude: j.latitude || j.location_details?.latitude,
      longitude: j.longitude || j.location_details?.longitude,
      location_details: j.location_details,
      completed_at: j.completed_at,
      rejected_at: j.rejected_at,
      expires_at: j.expires_at,
    }));
  },

  async findJobById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const job = await LabourJob.findById(id)
      .populate('posted_by', 'full_name email mobile')
      .populate('accepted_labourer_id', 'full_name email mobile')
      .lean();
    if (!job) return null;
    return {
      ...job,
      id: job._id.toString(),
      posted_by: job.posted_by?._id ? job.posted_by._id.toString() : (job.posted_by ? job.posted_by.toString() : null),
      farmer_name: job.posted_by?.full_name,
      farmer_email: job.posted_by?.email,
      farmer_mobile: job.posted_by?.mobile,
      accepted_labourer_name: job.accepted_labourer_id?.full_name || null,
      expected_cost: job.expected_cost || job.wage,
      work_description: job.work_description || job.description,
      required_date: job.required_date || job.work_date,
      latitude: job.latitude || job.location_details?.latitude,
      longitude: job.longitude || job.location_details?.longitude,
      location_details: job.location_details,
      completed_at: job.completed_at,
      rejected_at: job.rejected_at,
      expires_at: job.expires_at,
    };
  },

  async atomicAcceptJob(jobId, labourerId) {
    if (!mongoose.isValidObjectId(jobId)) return null;
    return LabourJob.findOneAndUpdate(
      { _id: jobId, status: { $in: ['OPEN', 'PENDING'] } },
      {
        $set: {
          status: 'BOOKED',
          accepted_labourer_id: labourerId,
        },
      },
      { new: true }
    ).lean();
  },

  async updateJobStatus(id, status, extra = {}) {
    if (!mongoose.isValidObjectId(id)) return;
    const update = { status, ...extra };
    if (status === 'COMPLETED' && !update.completed_at) update.completed_at = new Date();
    if (status === 'REJECTED' && !update.rejected_at) update.rejected_at = new Date();
    if (status === 'EXPIRED' && !update.expires_at) update.expires_at = new Date();
    await LabourJob.findByIdAndUpdate(id, update);
  },
};

module.exports = labourModel;

