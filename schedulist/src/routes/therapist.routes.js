const express = require('express');
const { check, validationResult } = require('express-validator');
const therapistController = require('../controllers/therapist.controller');
const { verifyToken, isTherapist } = require('../middleware/auth.middleware');

const router = express.Router();

// Middleware to validate request data
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Apply auth middleware to all routes
router.use(verifyToken, isTherapist);

// Get therapist dashboard summary
router.get('/dashboard', therapistController.getDashboardSummary);

// Get all patients assigned to this therapist
router.get('/patients', therapistController.getAssignedPatients);

// Get therapist's upcoming schedule
router.get('/schedule', therapistController.getUpcomingSchedule);

// Update appointment status
router.put(
  '/appointments/:id/status',
  [
    check('status', 'Status is required').isIn(['scheduled', 'completed', 'cancelled', 'no-show']),
  ],
  validate,
  therapistController.updateAppointmentStatus
);

module.exports = router;