const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const authController = {
  register: asyncHandler(async (req, res) => {
    const { email, password, step } = req.body;

    if (step === 'set-password') {
      const result = await authService.setPassword(email, password);
      return res.json({ success: true, ...result });
    }

    const result = await authService.requestSignup(email);
    res.json({ success: true, message: result.message });
  }),

  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ success: true, message: 'Login successful', ...result });
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const { token, email } = req.query;

    // Polling check from the frontend's "I've Verified My Gmail" button
    if (email && !token) {
      const result = await authService.checkVerifiedByEmail(email);
      return res.json(result);
    }

    // Actual link click from the emailed verification button
    if (token) {
      await authService.verifyEmailByToken(token);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.send(`
        <html><body style="font-family: Arial, sans-serif; text-align:center; padding-top: 80px;">
          <h2 style="color:#2D6A4F;">✅ Your email has been verified!</h2>
          <p>You can close this tab and return to the Smart Agriculture app to continue.</p>
          <a href="${frontendUrl}/signup" style="color:#2D6A4F;">Return to the app</a>
        </body></html>
      `);
    }

    throw new AppError('Missing verification token or email.', 400);
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email);
    res.json({ success: true, message: result.message });
  }),
};

module.exports = authController;