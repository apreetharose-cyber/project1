/**
 * MongoDB equivalent of the old database/seed.sql.
 *
 * MongoDB has no CREATE DATABASE / CREATE TABLE step -- Mongoose creates the
 * `agri_sharing` database and every collection automatically the first time
 * a document is inserted, using the indexes already declared in each
 * models/*.js schema. This script only needs to insert the demo documents.
 *
 * Idempotent: running it twice will not create duplicates -- it matches
 * existing demo users by email and skips/updates instead of erroring.
 *
 * Usage:
 *   npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const bcrypt = require('bcrypt');

// Requiring these registers every schema with Mongoose.
require('../models/userModel');
require('../models/profileModel');
require('../models/kycModel');
require('../models/equipmentModel');
require('../models/labourModel');

const equipmentModel = require('../models/equipmentModel');
const profileModel = require('../models/profileModel');

const User = mongoose.model('User');
const Kyc = mongoose.model('Kyc');
const LabourJob = mongoose.model('LabourJob');

const DEMO_USERS = [
  { full_name: 'Demo Farmer', email: 'demo.farmer@example.com', mobile: '9876500001', role: 'FARMER' },
  { full_name: 'Demo Owner', email: 'demo.owner@example.com', mobile: '9876500002', role: 'EQUIPMENT_OWNER' },
  { full_name: 'Demo Labourer', email: 'demo.labour@example.com', mobile: '9876500003', role: 'FARM_LABOUR' },
];

const DEMO_PROFILES = {
  'demo.farmer@example.com': { address: '12 Main Street', district: 'Salem', state: 'Tamil Nadu' },
  'demo.owner@example.com': { address: '45 Market Road', district: 'Erode', state: 'Tamil Nadu' },
  'demo.labour@example.com': { address: '7 Farm Lane', district: 'Coimbatore', state: 'Tamil Nadu' },
};

const DEMO_KYC_STATUS = {
  'demo.farmer@example.com': 'APPROVED',
  'demo.owner@example.com': 'APPROVED',
  'demo.labour@example.com': 'PENDING',
};

async function upsertDemoUser(userData) {
  const defaultPasswordHash = await bcrypt.hash('Password123', 10);
  const user = await User.findOneAndUpdate(
    { email: userData.email },
    {
      $set: {
        full_name: userData.full_name,
        mobile: userData.mobile,
        role: userData.role,
        password_hash: defaultPasswordHash,
        email_verified: true,
        account_status: 'ACTIVE',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return user;
}

async function seed() {
  await connectDB();
  console.log('Seeding demo data into MongoDB...');

  const demoEmails = DEMO_USERS.map((u) => u.email);
  const deleteResult = await User.deleteMany({ email: { $nin: demoEmails } });
  console.log(`  Removed ${deleteResult.deletedCount} non-demo user(s).`);

  const usersByEmail = {};
  for (const userData of DEMO_USERS) {
    const user = await upsertDemoUser(userData);
    usersByEmail[userData.email] = user;
    console.log(`  User ready: ${userData.email} (${user.id})`);
  }

  for (const [email, profileData] of Object.entries(DEMO_PROFILES)) {
    const user = usersByEmail[email];
    await profileModel.upsert(user.id, {
      address: profileData.address,
      district: profileData.district,
      state: profileData.state,
    });
  }
  console.log('  Profiles ready.');

  for (const [email, status] of Object.entries(DEMO_KYC_STATUS)) {
    const user = usersByEmail[email];
    await Kyc.findOneAndUpdate(
      { user_id: user.id },
      { $set: { status } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  console.log('  KYC statuses ready.');

  const owner = usersByEmail['demo.owner@example.com'];
  const existingEquipment = await equipmentModel.findByOwner(owner.id);

  let tractorId;
  let harvesterId;

  if (existingEquipment.length === 0) {
    tractorId = await equipmentModel.create(owner.id, {
      equipmentType: 'Tractor',
      brand: 'Mahindra',
      model: '575 DI',
      yearOfPurchase: 2020,
      pricePerHour: 300.0,
      pricePerDay: 2000.0,
      serviceArea: 'Within 20km of Erode',
      district: 'Erode',
      condition: 'GOOD',
      availability: 'Available',
    });
    await equipmentModel.setApprovalStatus(tractorId, 'APPROVED');
    await equipmentModel.addImages(tractorId, ['/uploads/equipment/sample-tractor.jpg']);

    harvesterId = await equipmentModel.create(owner.id, {
      equipmentType: 'Harvester',
      brand: 'John Deere',
      model: 'S550',
      yearOfPurchase: 2019,
      pricePerHour: 500.0,
      pricePerDay: 3500.0,
      serviceArea: 'Within 25km of Erode',
      district: 'Erode',
      condition: 'GOOD',
      availability: 'Available',
    });
    await equipmentModel.setApprovalStatus(harvesterId, 'APPROVED');
    await equipmentModel.addImages(harvesterId, ['/uploads/equipment/sample-harvester.jpg']);

    console.log('  Demo equipment created (Tractor, Harvester), both APPROVED.');
  } else {
    console.log('  Demo equipment already exists -- skipped.');
  }

  const farmer = usersByEmail['demo.farmer@example.com'];
  const existingJob = await LabourJob.findOne({ posted_by: farmer.id, work_type: 'FARM_LABOUR' });

  if (!existingJob) {
    await LabourJob.create({
      posted_by: farmer.id,
      work_type: 'FARM_LABOUR',
      district: 'Salem',
      wage: 600.0,
      work_date: new Date(),
      description: 'Paddy field weeding, 1 day work',
      status: 'OPEN',
    });
    console.log('  Demo labour job posting created.');
  } else {
    console.log('  Demo labour job already exists -- skipped.');
  }

  console.log('');
  console.log('Seeding complete.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
