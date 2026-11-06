const crypto = require('crypto');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const { signToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const AppError = require('../utils/AppError');

const TOKEN_TTL_MINUTES = 30;

const authService = {
  async requestSignup(email) {
    let user = await userModel.findByEmail(email);

    if (user && user.email_verified) {
      throw new AppError('An account with this Gmail already exists.', 409);
    }

    if (!user) {
      await userModel.create({ email });
      user = await userModel.findByEmail(email);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
    await userModel.setVerificationToken(user.id, token, expiry);

    await sendVerificationEmail(email, token);
    return { message: 'Verification email sent.' };
  },

  async verifyEmailByToken(token) {
    const user = await userModel.findByVerificationToken(token);
    if (!user) throw new AppError('This verification link is invalid or has expired.', 400);
    await userModel.markEmailVerified(user.id);
    return user;
  },

  async checkVerifiedByEmail(email) {
    const user = await userModel.findByEmail(email);
    if (!user) throw new AppError('No account found for this email.', 404);
    return { verified: Boolean(user.email_verified) };
  },

  async setPassword(email, password) {
    const user = await userModel.findByEmail(email);
    if (!user) throw new AppError('No account found for this email.', 404);
    if (!user.email_verified) throw new AppError('Please verify your Gmail before continuing.', 403);

    const passwordHash = await bcrypt.hash(password, 10);
    await userModel.setPassword(user.id, passwordHash);

    const token = signToken({ id: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.full_name, email: user.email, role: user.role } };
  },

  async login(email, password) {
    const user = await userModel.findByEmail(email);
    if (!user || !user.password_hash) throw new AppError('Invalid email or password.', 401);

    if (!user.email_verified) {
      const err = new AppError('Please verify your Gmail before logging in.', 403);
      err.reason = 'EMAIL_NOT_VERIFIED';
      throw err;
    }
    if (user.account_status !== 'ACTIVE') throw new AppError('Your account is not active. Please contact support.', 403);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new AppError('Invalid email or password.', 401);

    const token = signToken({ id: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.full_name, email: user.email, role: user.role } };
  },

  async requestPasswordReset(email) {
    const user = await userModel.findByEmail(email);
    if (!user) return { message: 'If an account exists for this email, a reset link has been sent.' };

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
    await userModel.setResetToken(user.id, token, expiry);
    await sendPasswordResetEmail(email, token);
    return { message: 'If an account exists for this email, a reset link has been sent.' };
  },
};

module.exports = authService;