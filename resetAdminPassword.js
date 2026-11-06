require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
require('../models/userModel');

async function main() {
  await connectDB();
  const User = mongoose.model('User');
  const email = (process.argv[2] || 'admin@gmail.com').trim().toLowerCase();
  const newPassword = process.argv[3] || 'Admin@123';
  const passwordHash = await bcrypt.hash(newPassword, 10);

  let user = await User.findOne({ email });
  if (user) {
    user.password_hash = passwordHash;
    user.role = 'ADMIN';
    user.account_status = 'ACTIVE';
    user.email_verified = true;
    await user.save();
    console.log(`\nSUCCESS: Password for ${email} has been set to: ${newPassword}\nRole: ADMIN | Status: ACTIVE\n`);
  } else {
    await User.create({
      full_name: 'Admin User',
      email,
      password_hash: passwordHash,
      role: 'ADMIN',
      email_verified: true,
      account_status: 'ACTIVE',
    });
    console.log(`\nSUCCESS: New ADMIN account created for ${email}\nPassword: ${newPassword}\n`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to set admin password:', err.message);
  process.exit(1);
});
