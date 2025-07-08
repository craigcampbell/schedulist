const express = require('express');
const { check, validationResult } = require('express-validator');
const patientController = require('../controllers/patient.controller');
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

// Get all patients (therapists see their assigned patients, admins/BCBAs see all)
router.get('/', isTherapist, patientController.getAllPatients);

// Check for duplicate color
router.get('/check-color', isTherapist, patientController.checkDuplicateColor);

// Get patient by ID (therapists need specific access to patient)
router.get('/:id', isTherapist, hasPatientAccess, patientController.getPatientById);

// Create a new patient (BCBA or admin only)
router.post(
  '/',
  isBCBA,
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('dateOfBirth', 'Date of birth is required').not().isEmpty(),
  ],
  validate,
  patientController.createPatient
);

// Update a patient (BCBA or admin only)
router.put(
  '/:id',
  isBCBA,
  hasPatientAccess,
  patientController.updatePatient
);

// Delete a patient (BCBA or admin only)
router.delete(
  '/:id',
  isBCBA,
  hasPatientAccess,
  patientController.deletePatient
);

// Get all notes for a patient
router.get(
  '/:id/notes',
  isTherapist,
  hasPatientAccess,
  patientController.getPatientNotes
);

// Create a note for a patient
router.post(
  '/:id/notes',
  isTherapist,
  hasPatientAccess,
  [
    check('content', 'Content is required').not().isEmpty(),
    check('noteType', 'Note type is required').isIn(['session', 'progress', 'assessment', 'general']),
  ],
  validate,
  patientController.createPatientNote
);

module.exports = router;