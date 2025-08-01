const { User, Role, Location, Patient, Appointment, Audit } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Get all users
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, active } = req.query;
    
    // Create a new approach for the query
    let include = [{ model: Role }];
    const where = {};
    
    // Filter users by organization
    if (req.user && req.user.organizationId) {
      where.organizationId = req.user.organizationId;
    }
    
    if (role && role !== 'all') {
      // Alternative approach for role filtering
      const roleWhere = { name: role };
      include = [{ 
        model: Role,
        where: roleWhere,
        required: true // This ensures INNER JOIN instead of LEFT JOIN
      }];
    }
    
    // Only filter by active status if explicitly provided
    if (active !== undefined) {
      where.active = active === 'true';
    }
    
    console.log('User query:', { where, organizationId: req.user?.organizationId, role, active });
    
    // First, let's check if there are ANY users in this organization
    const totalOrgUsers = await User.count({
      where: { organizationId: req.user?.organizationId }
    });
    console.log(`Total users in organization ${req.user?.organizationId}: ${totalOrgUsers}`);
    
    const users = await User.findAll({
      where,
      include,
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });
    
    console.log('Users found with filters:', users.length);
    
    // Debug: Check role associations
    if (users.length === 0 && role === 'therapist') {
      console.log('DEBUG: No therapists found, checking if roles exist...');
      
      // Check if the therapist role exists
      const therapistRole = await Role.findOne({ where: { name: 'therapist' } });
      console.log('Therapist role:', therapistRole ? therapistRole.id : 'Not found');
      
      // Check if any users have the therapist role
      if (therapistRole) {
        const usersWithTherapistRole = await User.findAll({
          include: [{
            model: Role,
            where: { id: therapistRole.id }
          }]
        });
        console.log('Total users with therapist role:', usersWithTherapistRole.length);
        
        // Check if any users in this organization exist
        const orgUsers = await User.findAll({
          where: { organizationId: req.user.organizationId }
        });
        console.log('Total users in this organization:', orgUsers.length);
      }
    }
    
    const formattedUsers = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      active: user.active,
      lastLogin: user.lastLogin,
      roles: user.Roles ? user.Roles.map(role => role.name) : [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    return res.status(200).json(formattedUsers);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      include: [
        { model: Role },
        { model: Location, as: 'Locations' },
        { model: Location, as: 'DefaultLocation' }
      ],
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const formattedUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      active: user.active,
      lastLogin: user.lastLogin,
      roles: user.Roles.map(role => role.name),
      locationIds: user.Locations.map(loc => loc.id),
      defaultLocationId: user.defaultLocationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    return res.status(200).json(formattedUser);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

/**
 * Create a new user with specified roles
 */
const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, roles, locationIds, defaultLocationId, active } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ where: { email } });
    
    if (userExists) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      active: active !== undefined ? active : true,
      organizationId: req.user.organizationId,
      defaultLocationId
    });
    
    // Assign roles
    if (Array.isArray(roles) && roles.length > 0) {
      const roleRecords = await Role.findAll({
        where: { name: { [Op.in]: roles } }
      });
      
      await user.setRoles(roleRecords);
    } else {
      // Default to therapist role if none specified
      const therapistRole = await Role.findOne({ where: { name: 'therapist' } });
      await user.addRole(therapistRole);
    }
    
    // Assign locations
    if (Array.isArray(locationIds) && locationIds.length > 0) {
      const locationRecords = await Location.findAll({
        where: { 
          id: { [Op.in]: locationIds },
          organizationId: req.user.organizationId
        }
      });
      
      await user.setLocations(locationRecords);
    }
    
    // Log the user creation
    await Audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'create',
      userId: req.user.id,
      organizationId: req.user.organizationId,
      req,
      metadata: {
        roles: roles || ['therapist'],
        locationIds: locationIds || []
      }
    });
    
    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

/**
 * Update a user
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, active, roles, locationIds, defaultLocationId, password } = req.body;
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Track changes for audit log
    const changes = [];
    
    // Update basic fields
    if (firstName !== undefined && firstName !== user.firstName) {
      changes.push({ fieldName: 'firstName', oldValue: user.firstName, newValue: firstName });
      user.firstName = firstName;
    }
    if (lastName !== undefined && lastName !== user.lastName) {
      changes.push({ fieldName: 'lastName', oldValue: user.lastName, newValue: lastName });
      user.lastName = lastName;
    }
    if (email && email !== user.email) {
      // Check if email is already in use
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      changes.push({ fieldName: 'email', oldValue: user.email, newValue: email });
      user.email = email;
    }
    if (phone !== undefined && phone !== user.phone) {
      changes.push({ fieldName: 'phone', oldValue: user.phone, newValue: phone });
      user.phone = phone;
    }
    if (active !== undefined && active !== user.active) {
      changes.push({ fieldName: 'active', oldValue: user.active, newValue: active });
      user.active = active;
    }
    if (defaultLocationId !== undefined && defaultLocationId !== user.defaultLocationId) {
      changes.push({ fieldName: 'defaultLocationId', oldValue: user.defaultLocationId, newValue: defaultLocationId });
      user.defaultLocationId = defaultLocationId;
    }
    if (password) {
      // Log password change separately with special action
      await Audit.log({
        entityType: 'User',
        entityId: user.id,
        action: 'password_change',
        fieldName: 'password',
        userId: req.user.id,
        organizationId: req.user.organizationId,
        req
      });
      user.password = password; // Will be hashed by the beforeUpdate hook
    }
    
    await user.save();
    
    // Log regular field changes
    if (changes.length > 0) {
      await Audit.logBulk('User', user.id, changes, req.user.id, req.user.organizationId, req);
    }
    
    // Update roles if provided
    if (Array.isArray(roles)) {
      const currentRoles = await user.getRoles();
      const currentRoleNames = currentRoles.map(r => r.name);
      
      if (JSON.stringify(currentRoleNames.sort()) !== JSON.stringify(roles.sort())) {
        const roleRecords = await Role.findAll({
          where: { name: { [Op.in]: roles } }
        });
        
        await user.setRoles(roleRecords);
        
        // Log role change
        await Audit.log({
          entityType: 'User',
          entityId: user.id,
          action: 'permission_change',
          fieldName: 'roles',
          oldValue: currentRoleNames.join(', '),
          newValue: roles.join(', '),
          userId: req.user.id,
          organizationId: req.user.organizationId,
          req
        });
      }
    }
    
    // Update locations if provided
    if (Array.isArray(locationIds)) {
      const currentLocations = await user.getLocations();
      const currentLocationIds = currentLocations.map(l => l.id);
      
      if (JSON.stringify(currentLocationIds.sort()) !== JSON.stringify(locationIds.sort())) {
        const locationRecords = await Location.findAll({
          where: { 
            id: { [Op.in]: locationIds },
            organizationId: req.user.organizationId
          }
        });
        
        await user.setLocations(locationRecords);
        
        // Log location change
        await Audit.log({
          entityType: 'User',
          entityId: user.id,
          action: 'update',
          fieldName: 'locations',
          oldValue: currentLocationIds.join(', '),
          newValue: locationIds.join(', '),
          userId: req.user.id,
          organizationId: req.user.organizationId,
          req
        });
      }
    }
    
    return res.status(200).json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        active: user.active
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

/**
 * Delete a user (or deactivate)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { deactivateOnly = true } = req.query;
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (deactivateOnly === 'true') {
      // Soft delete by setting active to false
      user.active = false;
      await user.save();
      
      // Log deactivation
      await Audit.log({
        entityType: 'User',
        entityId: user.id,
        action: 'update',
        fieldName: 'active',
        oldValue: 'true',
        newValue: 'false',
        userId: req.user.id,
        organizationId: req.user.organizationId,
        req,
        metadata: { reason: 'User deactivated via admin panel' }
      });
      
      return res.status(200).json({
        message: 'User deactivated successfully'
      });
    } else {
      // Log deletion before destroying
      await Audit.log({
        entityType: 'User',
        entityId: user.id,
        action: 'delete',
        userId: req.user.id,
        organizationId: req.user.organizationId,
        req,
        metadata: { 
          deletedUserEmail: user.email,
          deletedUserName: `${user.firstName} ${user.lastName}`
        }
      });
      
      // Hard delete - be careful
      await user.destroy();
      
      return res.status(200).json({
        message: 'User deleted successfully'
      });
    }
    
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

/**
 * Get all locations
 */
const getAllLocations = async (req, res) => {
  try {
    const { active } = req.query;
    
    const where = {
      organizationId: req.user.organizationId
    };
    
    // Only filter by active status if explicitly provided
    if (active !== undefined) {
      where.active = active === 'true';
    }
    
    const locations = await Location.findAll({
      where,
      order: [['name', 'ASC']]
    });
    
    return res.status(200).json(locations);
    
  } catch (error) {
    console.error('Error fetching locations:', error);
    return res.status(500).json({ message: 'Error fetching locations', error: error.message });
  }
};

/**
 * Create a new location
 */
const createLocation = async (req, res) => {
  try {
    const { name, address, city, state, zipCode, phone, workingHoursStart, workingHoursEnd, slotDuration } = req.body;
    
    const location = await Location.create({
      name,
      address,
      city,
      state,
      zipCode,
      phone,
      workingHoursStart: workingHoursStart || '08:00',
      workingHoursEnd: workingHoursEnd || '17:00',
      slotDuration: slotDuration || 30,
      active: true,
      organizationId: req.user.organizationId
    });
    
    return res.status(201).json({
      message: 'Location created successfully',
      location
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error creating location', error: error.message });
  }
};

/**
 * Update a location
 */
const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, city, state, zipCode, phone, active, workingHoursStart, workingHoursEnd, slotDuration } = req.body;
    
    const location = await Location.findOne({
      where: { 
        id,
        organizationId: req.user.organizationId
      }
    });
    
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    if (name !== undefined) location.name = name;
    if (address !== undefined) location.address = address;
    if (city !== undefined) location.city = city;
    if (state !== undefined) location.state = state;
    if (zipCode !== undefined) location.zipCode = zipCode;
    if (phone !== undefined) location.phone = phone;
    if (active !== undefined) location.active = active;
    if (workingHoursStart !== undefined) location.workingHoursStart = workingHoursStart;
    if (workingHoursEnd !== undefined) location.workingHoursEnd = workingHoursEnd;
    if (slotDuration !== undefined) location.slotDuration = slotDuration;
    
    await location.save();
    
    return res.status(200).json({
      message: 'Location updated successfully',
      location
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating location', error: error.message });
  }
};

/**
 * Delete a location
 */
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { deactivateOnly = true } = req.query;
    
    const location = await Location.findByPk(id);
    
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    
    // Check if location has appointments
    const appointmentCount = await Appointment.count({
      where: { locationId: id }
    });
    
    if (appointmentCount > 0 && deactivateOnly !== 'true') {
      return res.status(400).json({
        message: 'Cannot delete location with associated appointments. Deactivate instead.'
      });
    }
    
    if (deactivateOnly === 'true') {
      // Soft delete by setting active to false
      location.active = false;
      await location.save();
      
      return res.status(200).json({
        message: 'Location deactivated successfully'
      });
    } else {
      // Hard delete
      await location.destroy();
      
      return res.status(200).json({
        message: 'Location deleted successfully'
      });
    }
    
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting location', error: error.message });
  }
};

/**
 * Get admin dashboard summary
 */
const getDashboardSummary = async (req, res) => {
  try {
    // Count users by role
    const roles = await Role.findAll();
    
    const userCountsByRole = await Promise.all(
      roles.map(async role => {
        const count = await role.countUsers();
        return { role: role.name, count };
      })
    );
    
    // Count active patients
    const activePatientCount = await Patient.count({
      where: { status: 'active' }
    });
    
    // Count total patients
    const totalPatientCount = await Patient.count();
    
    // Count locations
    const locationCount = await Location.count();
    
    // Count upcoming appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const upcomingAppointmentsCount = await Appointment.count({
      where: {
        startTime: {
          [Op.between]: [today, nextWeek]
        },
        status: 'scheduled'
      }
    });
    
    return res.status(200).json({
      userCountsByRole,
      activePatientCount,
      totalPatientCount,
      inactivePatientCount: totalPatientCount - activePatientCount,
      locationCount,
      upcomingAppointmentsCount
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
  }
};

/**
 * Get audit logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      entityType,
      entityId,
      action,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;
    
    const where = {
      organizationId: req.user.organizationId
    };
    
    // Apply filters
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (userId) where.changedById = userId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    
    const offset = (page - 1) * limit;
    
    const { rows: audits, count } = await Audit.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'ChangedBy',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    const totalPages = Math.ceil(count / limit);
    
    return res.status(200).json({
      audits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages
      }
    });
    
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
  }
};

/**
 * Invite a user to join the platform
 */
const inviteUser = async (req, res) => {
  try {
    const { email, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Validate role
    const roleRecord = await Role.findOne({ where: { name: role } });
    if (!roleRecord) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
    
    // Generate invitation token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date();
    inviteExpires.setHours(inviteExpires.getHours() + 48); // 48 hours to accept invite
    
    // Create user with pending status
    const user = await User.create({
      email,
      firstName: 'Pending',
      lastName: 'User',
      password: crypto.randomBytes(32).toString('hex'), // Random password, user will set their own
      active: false, // Not active until they accept invite
      inviteToken,
      inviteExpires,
      organizationId: req.user.organizationId
    });
    
    // Assign the specified role
    await user.addRole(roleRecord);
    
    // Send invitation email
    try {
      // Configure email transporter (you'll need to set up your email service)
      const transporter = nodemailer.createTransport({
        // Example using Gmail - configure based on your email service
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      
      // Construct invite URL
      const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/accept-invite?token=${inviteToken}`;
      
      // Email content
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@schedulist.com',
        to: email,
        subject: 'Invitation to join Schedulist',
        html: `
          <h2>You've been invited to join Schedulist!</h2>
          <p>You've been invited to join as a <strong>${role}</strong> in our organization.</p>
          <p>Click the link below to accept the invitation and set up your account:</p>
          <p><a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a></p>
          <p>Or copy and paste this link in your browser:</p>
          <p>${inviteUrl}</p>
          <p>This invitation will expire in 48 hours.</p>
          <p>If you did not expect this invitation, please ignore this email.</p>
        `
      };
      
      await transporter.sendMail(mailOptions);
      
      return res.status(201).json({
        message: 'Invitation sent successfully',
        user: {
          id: user.id,
          email: user.email,
          role: role
        }
      });
      
    } catch (emailError) {
      // If email fails, still return success but log the error
      console.error('Failed to send invitation email:', emailError);
      
      // You might want to delete the user if email fails
      // await user.destroy();
      
      return res.status(201).json({
        message: 'User created but email failed to send. Please share the invite link manually.',
        inviteToken,
        user: {
          id: user.id,
          email: user.email,
          role: role
        }
      });
    }
    
  } catch (error) {
    console.error('Error inviting user:', error);
    return res.status(500).json({ message: 'Error inviting user', error: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getDashboardSummary,
  getAuditLogs,
  inviteUser
};