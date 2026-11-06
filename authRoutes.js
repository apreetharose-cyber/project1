const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Enter a valid Gmail address.').matches(/@gmail\.com$/).withMessage('Only Gmail addresses are supported.'),
    body('password').if(body('step').equals('set-password')).isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  validate,
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Enter a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  authController.login
);

router.get('/verify-email', authController.verifyEmail);

router.post('/forgot-password', [body('email').isEmail().withMessage('Enter a valid email address.')], validate, authController.forgotPassword);

module.exports = router;