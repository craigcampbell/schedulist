require('dotenv').config();
const { User } = require('./schedulist/src/models');
const { Sequelize } = require('sequelize');

async function updatePasswordsDirectly() {
  try {
    console.log('Directly updating passwords in the database...');
    
    // Use a known bcrypt hash for 'test123'
    const knownHash = '$2b$10$EiF9XJx8fA2.Pm8.LB7zwe/2D9WG1F8lDcTsqSRx3gZyQJZGipwQ2';
    
    // Update test accounts
    const testEmails = [
      'admin@sunshine.com',
      'bcba@sunshine.com', 
      'therapist@sunshine.com',
      'admin@hearts.com',
      'bcba@hearts.com',
      'therapist@hearts.com',
      'admin@coastal.com',
      'bcba@coastal.com',
      'therapist@coastal.com'
    ];
    
    // Use direct SQL to update
    for (const email of testEmails) {
      await User.update(
        { password: knownHash },
        { where: { email } }
      );
      console.log(`Direct password update for ${email}`);
    }
    
    console.log('\nAll passwords have been reset to: test123');
    console.log('You can now login with any of these emails and the password above.');
    
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    process.exit(0);
  }
}

updatePasswordsDirectly();