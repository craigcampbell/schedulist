require('dotenv').config();
const { sequelize, User, Role, Organization } = require('./schedulist/src/models');

async function checkUsers() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connection established successfully.');

    // Get organization ID from command line or list all orgs
    const organizationId = process.argv[2]; 
    
    if (organizationId) {
      // Check specific organization
      const organization = await Organization.findByPk(organizationId);
      if (!organization) {
        console.error(`Organization with ID ${organizationId} not found`);
        process.exit(1);
      }
      console.log(`\nOrganization: ${organization.name} (${organization.id})`);
      
      // Get all users for this organization
      const users = await User.findAll({
        where: { organizationId },
        include: [{ model: Role }],
        order: [['lastName', 'ASC'], ['firstName', 'ASC']]
      });
      
      console.log(`\nUsers for this organization: ${users.length}`);
      
      for (const user of users) {
        const roles = user.Roles.map(r => r.name).join(', ');
        console.log(`- ${user.firstName} ${user.lastName} (${user.email}): Roles: [${roles}], Active: ${user.active}`);
      }
      
      // Check role counts
      const roles = await Role.findAll();
      console.log('\nRole distribution:');
      
      for (const role of roles) {
        const count = await User.count({
          where: { organizationId },
          include: [{
            model: Role,
            where: { id: role.id },
            required: true
          }]
        });
        
        console.log(`- ${role.name}: ${count} users`);
      }
    } else {
      // List all organizations
      const organizations = await Organization.findAll();
      console.log(`\nTotal organizations: ${organizations.length}`);
      
      for (const org of organizations) {
        console.log(`- ${org.name} (${org.id})`);
        
        // Count users in this org
        const userCount = await User.count({ where: { organizationId: org.id } });
        console.log(`  Users: ${userCount}`);
      }
      
      console.log('\nRun this script with an organization ID to see details for that organization.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkUsers();