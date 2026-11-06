const labourModel = require('../models/labourModel');
const bookingModel = require('../models/bookingModel');
const notificationModel = require('../models/notificationModel');
const AppError = require('../utils/AppError');

const LICENCE_REQUIRED_TYPES = ['TRACTOR_DRIVER', 'HARVESTER_OPERATOR'];

const labourService = {
  async createJob(farmerId, data) {
    if (!data.workType || !data.workType.trim()) {
      throw new AppError('Work type is required.', 422);
    }
    if (!data.workDescription || !data.workDescription.trim()) {
      throw new AppError('Work description is required.', 422);
    }
    if (!data.landSize || !data.landSize.trim()) {
      throw new AppError('Land size is required.', 422);
    }
    if (!data.location || !data.location.trim()) {
      throw new AppError('Work location is mandatory for farm work posts.', 422);
    }
    if (data.latitude === undefined || data.latitude === null || data.longitude === undefined || data.longitude === null || isNaN(Number(data.latitude)) || isNaN(Number(data.longitude))) {
      throw new AppError('Valid location coordinates (latitude and longitude) are mandatory. Please pick location on the map.', 422);
    }
    if (!data.requiredDate && !data.workDate) {
      throw new AppError('Required date is required.', 422);
    }
    if (!data.expectedCost || Number(data.expectedCost) <= 0) {
      throw new AppError('Expected cost/wage is required and must be greater than 0.', 422);
    }

    const jobId = await labourModel.createJob(farmerId, data);
    return labourModel.findJobById(jobId);
  },

  async getMyPosts(farmerId) {
    const rows = await labourModel.getJobsByFarmer(farmerId);
    return rows.map((r) => ({
      id: r.id,
      workType: r.work_type,
      workDescription: r.work_description || r.description,
      description: r.work_description || r.description,
      landSize: r.land_size,
      location: r.location,
      latitude: r.latitude,
      longitude: r.longitude,
      locationDetails: r.location_details,
      district: r.district,
      expectedCost: r.expected_cost || r.wage,
      wage: r.expected_cost || r.wage,
      requiredDate: r.required_date || r.work_date,
      date: r.required_date || r.work_date,
      additionalRequirements: r.additional_requirements,
      status: r.status,
      employerName: r.employer_name,
    }));
  },

  async updateWorkProfile(userId, fields, files) {
    const workType = (fields.typeOfWork || '').toUpperCase().replace(/\s+/g, '_');

    if (LICENCE_REQUIRED_TYPES.includes(workType) && !files?.drivingLicence?.[0]) {
      const existing = await labourModel.findByUserId(userId);
      if (!existing?.driving_licence_path) {
        throw new AppError('Driving licence is required for this work type.', 422);
      }
    }

    await labourModel.upsertProfile(userId, {
      workType,
      age: fields.age,
      yearsExperience: fields.yearsOfExperience,
      dailyWage: fields.dailyWage,
      hourlyWage: fields.hourlyWage,
      availableDays: fields.availableDays,
      preferredWorkingArea: fields.preferredWorkingArea,
      experienceDescription: fields.experienceDescription,
      drivingLicencePath: files?.drivingLicence?.[0] ? `/uploads/licences/${files.drivingLicence[0].filename}` : undefined,
    });
  },

  async searchJobs(filters) {
    const rows = await labourModel.searchJobs(filters);
    return rows.map((r) => ({
      id: r.id,
      workType: r.work_type,
      employerName: r.employer_name,
      farmerName: r.farmer_name || r.employer_name,
      farmerEmail: r.farmer_email,
      farmerMobile: r.farmer_mobile,
      landSize: r.land_size,
      location: r.location,
      latitude: r.latitude,
      longitude: r.longitude,
      locationDetails: r.location_details,
      district: r.district,
      wage: r.expected_cost || r.wage,
      expectedCost: r.expected_cost || r.wage,
      date: r.required_date || r.work_date,
      requiredDate: r.required_date || r.work_date,
      description: r.work_description || r.description,
      workDescription: r.work_description || r.description,
      additionalRequirements: r.additional_requirements,
      status: r.status,
    }));
  },

  async applyToJob(jobId, labourerId) {
    const job = await labourModel.findJobById(jobId);
    if (!job) throw new AppError('This job posting no longer exists.', 404);
    if (job.status !== 'OPEN') throw new AppError('This job is no longer accepting bookings.', 400);

    const existingBooking = await bookingModel.findExistingLabourApplication(jobId, labourerId);
    if (existingBooking) {
      throw new AppError('You have already applied or booked for this farm work.', 400);
    }

    const bookingId = await bookingModel.createLabourApplication({
      jobId,
      labourerId,
      employerId: job.posted_by,
      requiredDate: job.required_date || job.work_date,
      expectedCost: job.expected_cost || job.wage,
    });

    await notificationModel.create(job.posted_by, {
      type: 'BOOKING_REQUEST',
      title: 'New Work Booking',
      message: 'A worker has booked your farm work post.',
    });

    return bookingId;
  },
};

module.exports = labourService;