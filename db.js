const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Connects to MongoDB via Mongoose. Called once from server.js before the
 * Express app starts listening -- the app should not start accepting
 * requests against a database that isn't actually connected yet.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to your .env file, e.g.:');
    console.error('MONGODB_URI=mongodb://127.0.0.1:27017/agri_sharing');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
  });

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
