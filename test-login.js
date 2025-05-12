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

// Test with the credentials from the seed script
const testCredentials = [
  { email: 'admin@sunshine.com', password: 'Password123' },
  { email: 'bcba@sunshine.com', password: 'Password123' },
  { email: 'therapist@sunshine.com', password: 'Password123' }
];

async function runTests() {
  console.log('Testing login credentials...');
  
  for (const cred of testCredentials) {
    console.log('\n-----------------------------------');
    const result = await testLogin(cred.email, cred.password);
    console.log(`Login test for ${cred.email}: ${result ? 'SUCCESS' : 'FAILED'}`);
    console.log('-----------------------------------\n');
  }
  
  // Test with incorrect password
  console.log('\n-----------------------------------');
  const badResult = await testLogin('admin@sunshine.com', 'WrongPassword');
  console.log(`Login test with wrong password: ${badResult ? 'SUCCESS (unexpected!)' : 'FAILED (expected)'}`);
  console.log('-----------------------------------\n');
  
  process.exit(0);
}

runTests();