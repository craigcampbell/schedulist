const jwt = require('jsonwebtoken');
const { User, Role, Organization } = require('../models');

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
      include: [
        { model: Role },
        { model: Organization }
      ]
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
      roles: user.Roles.map(role => role.name),
      organizationId: user.organizationId,
      organization: user.Organization ? {
        id: user.Organization.id,
        name: user.Organization.name,
        slug: user.Organization.slug,
        logoUrl: user.Organization.logoUrl,
        subscriptionActive: user.Organization.subscriptionActive
      } : null,
      isSuperAdmin: user.isSuperAdmin
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

const hasRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.roles.includes(role)) {
      return next();
    }

    return res.status(403).json({ message: `Requires ${role} role` });
  };
};  

/**
 * Middleware to check if organization has an active subscription
 */
const hasActiveSubscription = (req, res, next) => {
  // Allow admin users to access their account even without active subscription
  if (req.user && req.user.roles.includes('admin')) {
    return next();
  }
  
  // Check if the user belongs to an organization and has an active subscription
  if (req.user && req.user.organization && req.user.organization.subscriptionActive) {
    return next();
  }
  
  // Check if user is a super admin (platform admin)
  if (req.user && req.user.isSuperAdmin) {
    return next();
  }
  
  return res.status(402).json({ 
    message: 'Subscription required', 
    code: 'SUBSCRIPTION_REQUIRED',
    subscriptionRequired: true 
  });
};

/**
 * Middleware to redirect to tenant subdomain
 */
const tenantResolver = (req, res, next) => {
  // If no user or no organization, continue
  if (!req.user || !req.user.organization) {
    return next();
  }
  
  const host = req.get('host');
  const slug = req.user.organization.slug;
  
  // Check if already on correct subdomain
  if (host.startsWith(`${slug}.`)) {
    return next();
  }
  
  // For API requests, just continue
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Extract domain from current host
  const parts = host.split('.');
  const domain = parts.length > 1 ? parts.slice(1).join('.') : host;
  
  // Redirect to tenant subdomain
  const targetHost = `${slug}.${domain}`;
  const protocol = req.secure ? 'https' : 'http';
  const redirectUrl = `${protocol}://${targetHost}${req.originalUrl}`;
  
  return res.redirect(302, redirectUrl);
};

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      include: [
        { model: Organization },
        { model: Role }
      ]
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
      roles: user.Roles.map(role => role.name),
      organizationId: user.organizationId,
      organization: user.Organization ? {
        id: user.Organization.id,
        name: user.Organization.name,
        slug: user.Organization.slug,
        logoUrl: user.Organization.logoUrl,
        subscriptionActive: user.Organization.subscriptionActive
      } : null,
      isSuperAdmin: user.isSuperAdmin
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

/**
 * Middleware to extract organization from subdomain
 */
const subdomainExtractor = async (req, res, next) => {
  try {
    const host = req.get('host');
    
    // Skip for direct domain access
    if (!host.includes('.') || host.startsWith('www.')) {
      return next();
    }
    
    const subdomain = host.split('.')[0];
    
    // Skip for localhost or IP addresses
    if (subdomain === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return next();
    }
    
    // Lookup organization by slug
    const organization = await Organization.findOne({
      where: { slug: subdomain }
    });
    
    if (organization) {
      req.organization = {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl
      };
    }
    
    next();
  } catch (error) {
    console.error('Error in subdomain extraction:', error);
    next();
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isBCBA,
  isTherapist,
  hasPatientAccess,
  hasActiveSubscription,
  tenantResolver,
  subdomainExtractor,
  hasRole, 
  authenticate
};