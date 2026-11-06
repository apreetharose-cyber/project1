const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/userModel');

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Your session has expired. Please login again.', 401);
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw new AppError('Your session has expired. Please login again.', 401);
  }

  const user = await userModel.findById(decoded.id);
  if (!user) throw new AppError('User not found.', 401);
  if (user.account_status !== 'ACTIVE') throw new AppError('Your account is not active. Please contact support.', 403);

  req.user = user;
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to do that.', 403);
    }
    next();
  };
}

module.exports = { protect, requireRole };