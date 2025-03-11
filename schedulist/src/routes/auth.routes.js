const express = require('express');
const { check, validationResult } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Middleware to validate request data
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register a new user
router.post(
  '/register',
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  ],
  validate,
  authController.register
);

// Login user
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  validate,
  authController.login
);

// Get current user profile
router.get('/profile', verifyToken, authController.getProfile);

// Update user profile
router.put(
  '/profile',
  verifyToken,
  [
    check('firstName', 'First name must be valid').optional().not().isEmpty(),
    check('lastName', 'Last name must be valid').optional().not().isEmpty(),
    check('newPassword', 'New password must be at least 6 characters')
      .optional()
      .isLength({ min: 6 }),
  ],
  validate,
  authController.updateProfile
);

// Request password reset
router.post(
  '/forgot-password',
  [
    check('email', 'Please include a valid email').isEmail(),
  ],
  validate,
  authController.requestPasswordReset
);

// Reset password with token
router.post(
  '/reset-password',
  [
    check('token', 'Token is required').not().isEmpty(),
    check('newPassword', 'Password must be at least 6 characters').isLength({ min: 6 }),
  ],
  validate,
  authController.resetPassword
);

module.exports = router;