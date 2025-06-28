const express = require('express');
const { check, validationResult } = require('express-validator');
const scheduleController = require('../controllers/schedule.controller');
const { verifyToken, isTherapist, isBCBA, hasPatientAccess, authenticate } = require('../middleware/auth.middleware');

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

// Update appointment therapist assignment
router.put(
  '/:id/therapist',
  isBCBA,
  [
    check('therapistId', 'Therapist ID must be a valid ID or null').optional().isUUID()
  ],
  validate,
  scheduleController.updateAppointmentTherapist
);

// Delete an appointment
router.delete(
  '/:id',
  isBCBA,
  scheduleController.deleteAppointment
);

// Get team-based schedule
router.get('/teams', scheduleController.getTeamSchedule);

// Debug endpoint to check organization data
router.get('/debug-org', async (req, res) => {
  try {
    const { Appointment, User, Patient, Location } = require('../models');
    
    const userOrgId = req.user.organizationId;
    
    // Check users in this organization
    const orgUsers = await User.findAll({
      where: { organizationId: userOrgId },
      attributes: ['id', 'firstName', 'lastName', 'email']
    });
    
    // Check patients in this organization
    const orgPatients = await Patient.findAll({
      where: { organizationId: userOrgId },
      attributes: ['id', 'firstName', 'lastName']
    });
    
    // Check locations in this organization
    const orgLocations = await Location.findAll({
      where: { organizationId: userOrgId },
      attributes: ['id', 'name']
    });
    
    // Check all appointments with these users
    const userIds = orgUsers.map(u => u.id);
    const appointmentsWithOrgUsers = await Appointment.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { therapistId: { [require('sequelize').Op.in]: userIds } },
          { bcbaId: { [require('sequelize').Op.in]: userIds } }
        ]
      },
      attributes: ['id', 'startTime', 'therapistId', 'bcbaId', 'patientId'],
      limit: 10
    });
    
    res.json({
      organizationId: userOrgId,
      orgUsers: orgUsers.length,
      orgPatients: orgPatients.length,
      orgLocations: orgLocations.length,
      appointmentsWithOrgUsers: appointmentsWithOrgUsers.length,
      sampleUsers: orgUsers.slice(0, 3),
      sampleAppointments: appointmentsWithOrgUsers.slice(0, 3)
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

module.exports = router;