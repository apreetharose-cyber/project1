const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendVerificationEmail(toEmail, token) {
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const link = `${backendUrl}/api/auth/verify-email?token=${token}`;
  console.log(`\n========================================`);
  console.log(`🔗 [DEV] Email Verification Link for ${toEmail}:`);
  console.log(link);
  console.log(`========================================\n`);

  await transporter.sendMail({
    from: `"Smart Agriculture Platform" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify your Smart Agriculture Platform Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4332;">🌱 Smart Agriculture Resource Sharing</h2>
        <p>Thanks for signing up! Please verify your Gmail address to continue creating your account.</p>
        <a href="${link}" style="display:inline-block;background:#2D6A4F;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:bold;">Verify My Account</a>
        <p style="color:#666;font-size:13px;margin-top:24px;">This link expires in 30 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(toEmail, token) {
  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"Smart Agriculture Platform" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset your Smart Agriculture Platform password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1B4332;">🌱 Smart Agriculture Resource Sharing</h2>
        <p>We received a request to reset your password. Click below to choose a new one.</p>
        <a href="${link}" style="display:inline-block;background:#2D6A4F;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:bold;">Reset Password</a>
        <p style="color:#666;font-size:13px;margin-top:24px;">This link expires in 30 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };