const express = require('express');
const { check, validationResult } = require('express-validator');
const scheduleController = require('../controllers/schedule.controller');
const { verifyToken, isTherapist, isBCBA, hasPatientAccess } = require('../middleware/auth.middleware');

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
router.use(verifyToken);

// Get schedule (daily, weekly, monthly view)
router.get('/', isTherapist, scheduleController.getSchedule);

// Get patient schedule
router.get(
  '/patient/:patientId',
  isTherapist,
  scheduleController.getPatientSchedule
);

// Get next available slot for a therapist
router.get(
  '/next-available-slot',
  isBCBA,
  [
    check('therapistId', 'Therapist ID is required').not().isEmpty(),
    check('locationId', 'Location ID is required').not().isEmpty(),
  ],
  validate,
  scheduleController.getNextAvailableSlot
);

// Create a new appointment (BCBA or admin only)
router.post(
  '/',
  isBCBA,
  [
    check('patientId', 'Patient ID is required').not().isEmpty(),
    check('therapistId', 'Therapist ID is required').not().isEmpty(),
    check('locationId', 'Location ID is required').not().isEmpty(),
    // Skip start/end time validation when using next available slot
    check('startTime').custom((value, { req }) => {
      if (!req.body.useNextAvailableSlot && !value) {
        throw new Error('Start time is required when not using next available slot');
      }
      return true;
    }),
    check('endTime').custom((value, { req }) => {
      if (!req.body.useNextAvailableSlot && !value) {
        throw new Error('End time is required when not using next available slot');
      }
      return true;
    }),
  ],
  validate,
  scheduleController.createAppointment
);

// Update an appointment
router.put(
  '/:id',
  isBCBA,
  scheduleController.updateAppointment
);

// Delete an appointment
router.delete(
  '/:id',
  isBCBA,
  scheduleController.deleteAppointment
);

module.exports = router;