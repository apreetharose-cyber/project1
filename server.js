require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const kycRoutes = require('./routes/kycRoutes');
const equipmentRoutes = require('./routes/equipmentRoutes');
const labourRoutes = require('./routes/labourRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Backend is running.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/labour', labourRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use(errorHandler);

// The server must not start accepting requests until MongoDB is actually
// connected -- this was previously implicit with the mysql2 pool (which
// lazily connects on first query); Mongoose needs an explicit await here.
async function start() {
  await connectDB();

  // Run auto-expire/archive immediately on startup then every 30 minutes.
  // This ensures pending requests expire and old completed/rejected records are
  // archived even if no users are actively fetching their bookings.
  const bookingModel = require('./models/bookingModel');
  const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  const runCleanup = async () => {
    try {
      await bookingModel.autoExpireAndArchive();
      console.log(`[Cleanup] autoExpireAndArchive ran at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[Cleanup] autoExpireAndArchive error:', err.message);
    }
  };

  runCleanup(); // Run once immediately after DB connects
  setInterval(runCleanup, CLEANUP_INTERVAL_MS); // Then every 30 minutes

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start();
