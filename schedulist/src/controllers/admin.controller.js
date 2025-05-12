const { User, Role, Location, Patient, Appointment } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');

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
    
    if (active !== undefined) {
      where.active = active === 'true';
    }
    
    console.log('User query:', { where, organizationId: req.user?.organizationId, role });
    
    const users = await User.findAll({
      where,
      include,
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });
    
    console.log('Users found:', users.length);
    
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
      roles: user.Roles.map(role => role.name),
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
      include: [{ model: Role }],
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
    const { firstName, lastName, email, password, phone, roles } = req.body;
    
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
      active: true
    });
    
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
    const { firstName, lastName, email, phone, active, roles, password } = req.body;
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update basic fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email && email !== user.email) {
      // Check if email is already in use
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }
    if (phone) user.phone = phone;
    if (active !== undefined) user.active = active;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }
    
    await user.save();
    
    // Update roles if provided
    if (Array.isArray(roles) && roles.length > 0) {
      const roleRecords = await Role.findAll({
        where: { name: { [Op.in]: roles } }
      });
      
      await user.setRoles(roleRecords);
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
      
      return res.status(200).json({
        message: 'User deactivated successfully'
      });
    } else {
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
    
    const where = {};
    
    if (active !== undefined) {
      where.active = active === 'true';
    }
    
    const locations = await Location.findAll({
      where,
      order: [['name', 'ASC']]
    });
    
    return res.status(200).json(locations);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching locations', error: error.message });
  }
};

/**
 * Create a new location
 */
const createLocation = async (req, res) => {
  try {
    const { name, address, city, state, zipCode, phone } = req.body;
    
    const location = await Location.create({
      name,
      address,
      city,
      state,
      zipCode,
      phone,
      active: true
    });
    
    return res.status(201).json({
      message: 'Location created successfully',
      location: {
        id: location.id,
        name: location.name
      }
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
    const { name, address, city, state, zipCode, phone, active } = req.body;
    
    const location = await Location.findByPk(id);
    
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    if (name) location.name = name;
    if (address) location.address = address;
    if (city) location.city = city;
    if (state) location.state = state;
    if (zipCode) location.zipCode = zipCode;
    if (phone) location.phone = phone;
    if (active !== undefined) location.active = active;
    
    await location.save();
    
    return res.status(200).json({
      message: 'Location updated successfully',
      location: {
        id: location.id,
        name: location.name,
        active: location.active
      }
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
  getDashboardSummary
};