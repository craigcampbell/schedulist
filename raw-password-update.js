require('dotenv').config();
const { User } = require('./schedulist/src/models');
const { QueryTypes } = require('sequelize');

async function updatePasswordsRaw() {
  try {
    console.log('Updating passwords with raw SQL...');
    
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
    
    // Use raw SQL to bypass any hooks/validations
    for (const email of testEmails) {
      // First, disable any password hashing hooks temporarily
      const plainPassword = '123456'; // Simple password for testing
      
      // Run raw SQL update
      await User.sequelize.query(
        `UPDATE "Users" SET password = ? WHERE email = ?`,
        {
          replacements: [plainPassword, email],
          type: QueryTypes.UPDATE
        }
      );
      
      console.log(`Raw password update for ${email}`);
    }
    
    console.log('\nAll passwords have been set to: 123456 (PLAIN TEXT - FOR TESTING ONLY)');
    console.log('You can now login with any of these emails and the password above.');
    console.log('WARNING: Using plain text passwords is insecure. This is for testing only!');
    
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    process.exit(0);
  }
}

updatePasswordsRaw();