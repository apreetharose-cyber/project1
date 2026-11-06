require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const userModel = require('../models/userModel');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  await connectDB();

  console.log('=== Create Admin Account ===');
  const email = await ask('Admin email: ');
  const password = await ask('Admin password (min 8 chars): ');
  const fullName = await ask('Admin full name: ');
  rl.close();

  if (!email || !password || password.length < 8) {
    console.error('Invalid input. Email and an 8+ character password are required.');
    process.exit(1);
  }

  const existing = await userModel.findByEmail(email);
  if (existing) {
    console.error('A user with this email already exists.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const User = mongoose.model('User');
  await User.create({
    full_name: fullName,
    email,
    password_hash: passwordHash,
    role: 'ADMIN',
    email_verified: true,
    account_status: 'ACTIVE',
  });

  console.log(`Admin account created for ${email}. Log in at /admin/login.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});
