const express = require('express');
const { check, validationResult } = require('express-validator');
const bcbaController = require('../controllers/bcba.controller');
// import { authenticate, hasRole } from '../middleware/auth.middleware';
const { authenticate, hasRole } = require('../middleware/auth.middleware');
const { verifyToken, isBCBA } = require('../middleware/auth.middleware');

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
router.use(verifyToken, isBCBA);

// Get dashboard summary for BCBA
router.get('/dashboard', bcbaController.getDashboardSummary);

// Get all therapists managed by this BCBA
router.get('/therapists', bcbaController.getTherapists);

// Add a new therapist
router.post(
  '/therapists',
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  ],
  validate,
  bcbaController.addTherapist
);

// Update a therapist
router.put(
  '/therapists/:id',
  bcbaController.updateTherapist
);

// Assign patients to a therapist
router.post(
  '/therapists/:id/patients',
  [
    check('patientIds', 'Patient IDs must be an array').isArray(),
  ],
  validate,
  bcbaController.assignPatients
);

// Get available therapists for assignment (org level)
router.get('/available-therapists', bcbaController.getAvailableTherapists);

// Get available BCBAs for assignment (org level)
router.get('/available-bcbas', bcbaController.getAvailableBCBAs);

// Get patients with assignments
router.get('/patients-with-assignments', authenticate, bcbaController.getPatientsWithAssignments);

// Set primary BCBA for a patient
router.post(
  '/set-primary-bcba',
  [
    check('patientId', 'Patient ID is required').not().isEmpty(),
    check('bcbaId', 'BCBA ID is required').not().isEmpty(),
  ],
  validate,
  bcbaController.setPrimaryBCBA
);

// Update therapist assignment
router.post(
  '/update-therapist-assignment',
  [
    check('patientId', 'Patient ID is required').not().isEmpty(),
    check('therapistId', 'Therapist ID is required').not().isEmpty(),
    check('action', 'Action must be either "assign" or "unassign"').isIn(['assign', 'unassign']),
  ],
  validate,
  bcbaController.updateTherapistAssignment
);

// router.get(
//   'unassigned-patients',
//   authenticate,
//   hasRole('bcba', 'admin'),
//   bcbaController.getUnassignedPatients
// );

router.get('/unassigned-patients', authenticate, bcbaController.getUnassignedPatients);

// Update BCBA assignment
router.post(
  '/update-bcba-assignment',
  [
    check('patientId', 'Patient ID is required').not().isEmpty(),
    check('bcbaId', 'BCBA ID is required').not().isEmpty(),
    check('action', 'Action must be either "assign" or "unassign"').isIn(['assign', 'unassign']),
  ],
  validate,
  bcbaController.updateBCBAAssignment
);

module.exports = router;