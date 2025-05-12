require('dotenv').config();
const { sequelize, User, Role, Organization } = require('./schedulist/src/models');
const bcrypt = require('bcrypt');

async function createTestTherapist() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connection established successfully.');

    // Find organization by ID
    const organizationId = process.argv[2]; // Pass org ID as command line arg
    if (!organizationId) {
      console.error('Please provide an organization ID as the first argument');
      process.exit(1);
    }

    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      console.error(`Organization with ID ${organizationId} not found`);
      process.exit(1);
    }
    console.log(`Found organization: ${organization.name}`);

    // Find or create therapist role
    const [therapistRole] = await Role.findOrCreate({
      where: { name: 'therapist' },
      defaults: { description: 'Therapist role' }
    });
    console.log(`Using therapist role: ${therapistRole.id}`);

    // Check if a test therapist already exists
    const existingTherapist = await User.findOne({
      where: { 
        email: 'test.therapist@example.com',
        organizationId: organizationId 
      }
    });

    if (existingTherapist) {
      console.log('Test therapist already exists:', existingTherapist.id);
      
      // Make sure the therapist has the therapist role
      const hasRole = await existingTherapist.hasRole(therapistRole);
      if (!hasRole) {
        await existingTherapist.addRole(therapistRole);
        console.log('Added therapist role to existing user');
      } else {
        console.log('User already has therapist role');
      }
      
      // Ensure user is active
      if (!existingTherapist.active) {
        existingTherapist.active = true;
        await existingTherapist.save();
        console.log('Activated existing therapist');
      }
    } else {
      // Create a new test therapist
      const newTherapist = await User.create({
        firstName: 'Test',
        lastName: 'Therapist',
        email: 'test.therapist@example.com',
        password: 'password123', // Will be hashed by model hooks
        active: true,
        organizationId: organizationId
      });
      
      // Assign therapist role
      await newTherapist.addRole(therapistRole);
      console.log('Created new test therapist:', newTherapist.id);
    }

    // Verify therapists exist for this organization
    const therapistsCount = await User.count({
      where: { organizationId: organizationId },
      include: [{
        model: Role,
        where: { name: 'therapist' },
        required: true
      }]
    });
    
    console.log(`Total therapists for organization: ${therapistsCount}`);
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

createTestTherapist();