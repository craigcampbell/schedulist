require('dotenv').config();
const bcrypt = require('bcrypt');
const { User, Role, Organization } = require('./schedulist/src/models');

async function testLogin(email, password) {
  try {
    console.log(`Attempting to login with email: ${email}`);
    
    // Find the user
    const user = await User.findOne({ 
      where: { email },
      include: [
        { model: Role },
        { model: Organization }
      ]
    });
    
    if (!user) {
      console.log('User not found!');
      return false;
    }
    
    console.log(`User found: ${user.firstName} ${user.lastName}`);
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('Password is invalid!');
      return false;
    }
    
    console.log('Password is valid!');
    console.log('User details:', {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      roles: user.Roles.map(r => r.name),
      organization: user.Organization ? user.Organization.name : 'None'
    });
    
    return true;
  } catch (error) {
    console.error('Error during login test:', error);
    return false;
  }
}

// Test with the updated password
const testCredentials = [
  { email: 'admin@sunshine.com', password: 'test123' },
  { email: 'bcba@sunshine.com', password: 'test123' },
  { email: 'therapist@sunshine.com', password: 'test123' }
];

async function runTests() {
  console.log('Testing login credentials with new password...');
  
  for (const cred of testCredentials) {
    console.log('\n-----------------------------------');
    const result = await testLogin(cred.email, cred.password);
    console.log(`Login test for ${cred.email}: ${result ? 'SUCCESS' : 'FAILED'}`);
    console.log('-----------------------------------\n');
  }
  
  process.exit(0);
}

runTests();