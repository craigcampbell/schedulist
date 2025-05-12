const express = require('express');
const { verifyToken, isAdmin, isBCBA } = require('../middleware/auth.middleware');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

// Middleware to verify token
router.use(verifyToken);

// Proxy route for locations - accessible by both admins and BCBAs
router.get('/locations', async (req, res, next) => {
  try {
    const isAdminUser = req.user && req.user.roles.includes('admin');
    const isBcbaUser = req.user && req.user.roles.includes('bcba');
    
    if (isAdminUser || isBcbaUser) {
      // Forward to the admin controller
      return adminController.getAllLocations(req, res, next);
    } else {
      return res.status(403).json({ 
        message: 'Access denied. This endpoint requires admin or BCBA role.' 
      });
    }
  } catch (error) {
    console.error('Proxy route error:', error);
    return res.status(500).json({ 
      message: 'Server error in proxy route', 
      error: error.message 
    });
  }
});

module.exports = router;