const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organization.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');
const { uploadLogo, handleMulterError } = require('../middleware/upload.middleware');

// Public routes
router.post('/', organizationController.create);
router.get('/by-slug/:slug', organizationController.findBySlug);

// Protected routes - require authentication
router.get('/details', [verifyToken, isAdmin], organizationController.getDetails);
router.put('/', [verifyToken, isAdmin], organizationController.update);
router.put('/subscription', [verifyToken, isAdmin], organizationController.updateSubscription);

// Logo upload with multer middleware
router.post('/logo', [verifyToken, isAdmin, uploadLogo, handleMulterError], organizationController.uploadLogo);

module.exports = router;