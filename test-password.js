const db = require('./schedulist/src/models');
const bcrypt = require('bcrypt');

async function checkPassword() {
  try {
    const user = await db.User.findOne({ where: { email: 'bcba@sunshine.com' } });
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('User found:', user.email);
    console.log('Stored password hash:', user.password.substring(0, 20) + '...');
    
    // Test password verification
    const isValid = await bcrypt.compare('password123', user.password);
    console.log('Password "password123" valid:', isValid);
    
    // Try different passwords
    const altPasswords = ['password', 'Password123', 'admin', 'bcba123'];
    for (const pwd of altPasswords) {
      const valid = await bcrypt.compare(pwd, user.password);
      console.log(`Password '${pwd}' valid: ${valid}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

checkPassword();