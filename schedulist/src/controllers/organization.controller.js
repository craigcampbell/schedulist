const db = require('../models');
const Organization = db.Organization;
const User = db.User;
const Role = db.Role;
const { Op } = db.Sequelize;

// Create a new organization
exports.create = async (req, res) => {
  try {
    const { name, slug, email, firstName, lastName, password, phone } = req.body;

    // Check if organization with same slug already exists
    const existingOrg = await Organization.findOne({ where: { slug } });
    if (existingOrg) {
      return res.status(400).json({ 
        message: "Organization with this name already exists. Please add a location identifier (e.g. 'acme-texas')" 
      });
    }

    // Create organization
    const organization = await Organization.create({
      name,
      slug,
      active: true,
      subscriptionActive: false,
      subscriptionTier: 'free'
    });

    // Find admin role
    const adminRole = await Role.findOne({
      where: { name: 'admin' }
    });

    if (!adminRole) {
      return res.status(500).json({ message: "Admin role not found" });
    }

    // Create admin user for organization
    const adminUser = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      active: true,
      organizationId: organization.id
    });

    // Assign admin role
    await adminUser.addRole(adminRole);

    return res.status(201).json({
      message: "Organization and admin user created successfully",
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      adminId: adminUser.id
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return res.status(500).json({ message: error.message || "An error occurred while creating the organization" });
  }
};

// Get organization by slug
exports.findBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const organization = await Organization.findOne({
      where: { slug },
      include: [
        {
          model: User,
          as: 'users',
          attributes: ['id', 'firstName', 'lastName', 'email', 'active'],
          through: { attributes: [] }
        }
      ]
    });
    
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }
    
    return res.status(200).json(organization);
  } catch (error) {
    console.error('Error finding organization:', error);
    return res.status(500).json({ message: error.message || "An error occurred while retrieving the organization" });
  }
};

// Get organization details (for admin dashboard)
exports.getDetails = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ message: "User is not associated with an organization" });
    }
    
    const organization = await Organization.findByPk(organizationId, {
      include: [
        {
          model: User,
          as: 'users',
          attributes: ['id', 'firstName', 'lastName', 'email', 'active']
        }
      ]
    });
    
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }
    
    // Get counts for summary
    const usersCount = await User.count({ where: { organizationId } });
    const activeUsersCount = await User.count({ where: { organizationId, active: true } });
    
    return res.status(200).json({
      ...organization.toJSON(),
      summary: {
        totalUsers: usersCount,
        activeUsers: activeUsersCount
      }
    });
  } catch (error) {
    console.error('Error getting organization details:', error);
    return res.status(500).json({ message: error.message || "An error occurred while retrieving organization details" });
  }
};

// Update organization
exports.update = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ message: "User is not associated with an organization" });
    }
    
    const { name, logoUrl } = req.body;
    
    const organization = await Organization.findByPk(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }
    
    // Update fields
    if (name) organization.name = name;
    if (logoUrl !== undefined) organization.logoUrl = logoUrl;
    
    await organization.save();
    
    return res.status(200).json({
      message: "Organization updated successfully",
      organization
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return res.status(500).json({ message: error.message || "An error occurred while updating the organization" });
  }
};

// Update subscription
exports.updateSubscription = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ message: "User is not associated with an organization" });
    }
    
    const { 
      subscriptionActive, 
      paidLocationsCount,
      additionalUsersCount,
      subscriptionStartDate,
      subscriptionEndDate,
      paymentDetails,
      subscriptionTier
    } = req.body;
    
    const organization = await Organization.findByPk(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }
    
    // Default values based on tier
    let includedUsersPerLocation = 5;
    let basePrice = 10;
    let additionalLocationPrice = 5;
    let additionalUserPrice = 1;
    
    // Calculate monthly rate
    const totalLocations = paidLocationsCount || 0;
    const additionalUsers = additionalUsersCount || 0;
    const includedUsers = totalLocations * includedUsersPerLocation;
    
    const locationsPrice = basePrice + (additionalLocationPrice * (totalLocations - 1));
    const usersPrice = additionalUserPrice * additionalUsers;
    const monthlyRate = totalLocations > 0 ? (locationsPrice + usersPrice) : 0;
    
    // Update subscription fields
    organization.subscriptionActive = subscriptionActive === undefined ? organization.subscriptionActive : subscriptionActive;
    organization.paidLocationsCount = paidLocationsCount || organization.paidLocationsCount;
    organization.includedUsersCount = includedUsers;
    organization.additionalUsersCount = additionalUsersCount || organization.additionalUsersCount;
    organization.subscriptionStartDate = subscriptionStartDate || organization.subscriptionStartDate;
    organization.subscriptionEndDate = subscriptionEndDate || organization.subscriptionEndDate;
    organization.monthlyRate = monthlyRate;
    organization.subscriptionTier = subscriptionTier || organization.subscriptionTier;
    
    await organization.save();
    
    return res.status(200).json({
      message: "Subscription updated successfully",
      subscription: {
        subscriptionActive: organization.subscriptionActive,
        paidLocationsCount: organization.paidLocationsCount,
        includedUsersCount: organization.includedUsersCount,
        additionalUsersCount: organization.additionalUsersCount,
        monthlyRate: organization.monthlyRate,
        subscriptionTier: organization.subscriptionTier,
        subscriptionStartDate: organization.subscriptionStartDate,
        subscriptionEndDate: organization.subscriptionEndDate
      }
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return res.status(500).json({ message: error.message || "An error occurred while updating the subscription" });
  }
};

// Upload organization logo
exports.uploadLogo = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ message: "User is not associated with an organization" });
    }
    
    const organization = await Organization.findByPk(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }
    
    // Multer middleware has processed the file upload
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Get the file path relative to server
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const logoPath = `/uploads/logos/${req.file.filename}`;
    const logoUrl = `${baseUrl}${logoPath}`;
    
    // Update the logo URL in database
    organization.logoUrl = logoUrl;
    await organization.save();
    
    // If there was a previous logo, we could delete the old file here
    
    return res.status(200).json({
      message: "Logo uploaded successfully",
      logoUrl: organization.logoUrl
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return res.status(500).json({ message: error.message || "An error occurred while uploading the logo" });
  }
};