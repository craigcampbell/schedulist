const express = require('express');
const { check, validationResult } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const teamController = require('../controllers/team.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

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
router.use(verifyToken, isAdmin);

// Get admin dashboard summary
router.get('/dashboard', adminController.getDashboardSummary);

// Audit log routes
router.get('/audit-logs', adminController.getAuditLogs);

// User management routes
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.post(
  '/users',
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('roles', 'Roles must be an array').optional().isArray(),
  ],
  validate,
  adminController.createUser
);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post(
  '/users/invite',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('role', 'Role is required').not().isEmpty(),
  ],
  validate,
  adminController.inviteUser
);

// Location management routes
router.get('/locations', adminController.getAllLocations);
router.post(
  '/locations',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('address', 'Address is required').not().isEmpty(),
    check('city', 'City is required').not().isEmpty(),
    check('state', 'State is required').not().isEmpty(),
    check('zipCode', 'Zip code is required').not().isEmpty(),
  ],
  validate,
  adminController.createLocation
);
router.put('/locations/:id', adminController.updateLocation);
router.delete('/locations/:id', adminController.deleteLocation);

// Team management routes
router.get('/teams', teamController.getTeams);
router.post('/teams', teamController.createTeam);
router.put('/teams/:id', teamController.updateTeam);
router.post('/teams/:id/members', teamController.addTeamMember);
router.delete('/teams/:id/members/:memberId', teamController.removeTeamMember);
router.delete('/teams/:id', teamController.deleteTeam);

module.exports = router;