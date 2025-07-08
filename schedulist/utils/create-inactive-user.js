const db = require('../src/models');

async function createInactiveUser() {
  try {
    // Find the Sunshine organization
    const org = await db.Organization.findOne({
      where: { slug: 'sunshine' }
    });
    
    if (!org) {
      console.error('Sunshine organization not found');
      process.exit(1);
    }
    
    // Find therapist role
    const therapistRole = await db.Role.findOne({
      where: { name: 'therapist' }
    });
    
    // Create an inactive user
    const inactiveUser = await db.User.create({
      firstName: 'Inactive',
      lastName: 'TestUser',
      email: 'inactive@sunshine.com',
      password: 'Password123',
      phone: '(555) 000-0000',
      organizationId: org.id,
      active: false // This user is inactive
    });
    
    // Assign therapist role
    await inactiveUser.addRole(therapistRole);
    
    console.log('Inactive user created successfully:');
    console.log({
      email: inactiveUser.email,
      name: `${inactiveUser.firstName} ${inactiveUser.lastName}`,
      active: inactiveUser.active
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating inactive user:', error);
    process.exit(1);
  }
}

createInactiveUser();