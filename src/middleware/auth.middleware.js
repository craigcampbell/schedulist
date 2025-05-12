const jwt = require('jsonwebtoken');
const { User, Role, Patient } = require('../models');

/**
 * Middleware to verify JWT token
 */
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findByPk(decoded.id, {
      include: [{ model: Role }]
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    if (!user.active) {
      return res.status(403).json({ message: 'User account is inactive' });
    }
    
    // Attach user info to the request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.Roles.map(role => role.name)
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Middleware to check if user has admin role
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.roles.includes('admin')) {
    return next();
  }
  
  return res.status(403).json({ message: 'Requires admin role' });
};

/**
 * Middleware to check if user has BCBA role
 */
const isBCBA = (req, res, next) => {
  if (req.user && (req.user.roles.includes('bcba') || req.user.roles.includes('admin'))) {
    return next();
  }
  
  return res.status(403).json({ message: 'Requires BCBA role' });
};

/**
 * Middleware to check if user has therapist role
 */
const isTherapist = (req, res, next) => {
  if (req.user && (req.user.roles.includes('therapist') || req.user.roles.includes('bcba') || req.user.roles.includes('admin'))) {
    return next();
  }
  
  return res.status(403).json({ message: 'Requires therapist role' });
};

/**
 * Middleware to check if user has access to a specific patient
 */
const hasPatientAccess = async (req, res, next) => {
  try {
    const { id: userId, roles } = req.user;
    const patientId = req.params.id;
    
    // Admins have access to all patients
    if (roles.includes('admin')) {
      return next();
    }
    
    const user = await User.findByPk(userId, {
      include: [{ 
        model: Patient, 
        as: 'Patients',
        where: { id: patientId },
        required: false
      }]
    });
    
    if (!user.Patients || user.Patients.length === 0) {
      return res.status(403).json({ message: 'You do not have access to this patient' });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isBCBA,
  isTherapist,
  hasPatientAccess
};