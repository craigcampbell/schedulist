const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const crypto = require('crypto');
const { Op } = require('sequelize');

/**
 * Register a new user with therapist role
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ where: { email } });
    
    if (userExists) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    // Create the user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone
    });
    
    // Assign therapist role by default
    const therapistRole = await Role.findOne({ where: { name: 'therapist' } });
    await user.addRole(therapistRole);
    
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

/**
 * Login user and return JWT token
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find the user
    const user = await User.findOne({ 
      where: { email },
      include: [{ model: Role }]
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Check if account is active
    if (!user.active) {
      return res.status(403).json({ message: 'Account is inactive. Please contact an administrator.' });
    }
    
    // Verify password
    const isPasswordValid = await user.isValidPassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    return res.status(200).json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.Roles.map(role => role.name)
      },
      token
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findByPk(userId, {
      include: [{ model: Role }],
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        roles: user.Roles.map(role => role.name),
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phone, currentPassword, newPassword } = req.body;
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update basic info
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    
    // If password change is requested
    if (currentPassword && newPassword) {
      const isPasswordValid = await user.isValidPassword(currentPassword);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      user.password = newPassword;
    }
    
    await user.save();
    
    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

/**
 * Request password reset
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token and save to user
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
      
    user.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
    
    await user.save();
    
    // In a real application, send an email with the reset link
    // For now, just return the token (for development purposes)
    return res.status(200).json({
      message: 'Password reset link sent to email',
      resetToken // In production, don't return this
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error requesting password reset', error: error.message });
  }
};

/**
 * Reset password with token
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
      
    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: Date.now() }
      }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    // Update password
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    
    await user.save();
    
    return res.status(200).json({
      message: 'Password reset successful'
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  requestPasswordReset,
  resetPassword
};