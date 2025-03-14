require('dotenv').config();
const bcrypt = require('bcrypt');
const { User } = require('./schedulist/src/models');

async function resetPasswords() {
  try {
    console.log('Resetting passwords for test accounts...');
    
    // Use a simple password for testing
    const testPassword = 'test123';
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(testPassword, salt);
    
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
    
    for (const email of testEmails) {
      const user = await User.findOne({ where: { email } });
      
      if (user) {
        user.password = hashedPassword;
        await user.save();
        console.log(`Reset password for ${email}`);
      } else {
        console.log(`User not found: ${email}`);
      }
    }
    
    console.log('\nAll passwords have been reset to:', testPassword);
    console.log('You can now login with any of these emails and the password above.');
    
  } catch (error) {
    console.error('Error resetting passwords:', error);
  } finally {
    process.exit(0);
  }
}

resetPasswords();