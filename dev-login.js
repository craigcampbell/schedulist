// This file creates a JWT token for development purposes only
// DO NOT USE IN PRODUCTION

const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
require('dotenv').config();

// Load models for development login
let db;
try {
  db = require('./schedulist/src/models');
} catch (e) {
  console.error('Could not load models, proceeding with mock user IDs');
  console.error(e);
}

// Create a token for given user ID and roles
const createToken = (userId, roles = ['admin']) => {
  const payload = {
    id: userId
  };

  // Sign the token - ensure JWT_SECRET is in your .env file
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });

  return token;
};

// Main function to find or create tokens for testing
const generateTokens = async () => {
  console.log('\n=== DEV LOGIN UTILITY ===');
  console.log('Generating tokens for development testing...\n');
  
  // If models are available, try to find real user IDs
  if (db) {
    try {
      // Find or create admin and bcba users
      const adminRole = await db.Role.findOne({ where: { name: 'admin' } });
      const bcbaRole = await db.Role.findOne({ where: { name: 'bcba' } });
      
      if (!adminRole || !bcbaRole) {
        console.error('Roles not found in database. Creating mock tokens.');
      } else {
        // Find admin user
        const adminUser = await db.User.findOne({
          include: [{
            model: db.Role,
            where: { id: adminRole.id }
          }]
        });
        
        // Find BCBA user
        const bcbaUser = await db.User.findOne({
          include: [{
            model: db.Role,
            where: { id: bcbaRole.id }
          }]
        });
        
        // Generate tokens from real users if available
        if (adminUser) {
          const adminToken = createToken(adminUser.id);
          console.log(`Admin Token for ${adminUser.email}:`);
          console.log(adminToken);
          console.log(`User ID: ${adminUser.id}, Name: ${adminUser.firstName} ${adminUser.lastName}\n`);
        } else {
          console.log('No admin user found in database.\n');
        }
        
        if (bcbaUser) {
          const bcbaToken = createToken(bcbaUser.id);
          console.log(`BCBA Token for ${bcbaUser.email}:`);
          console.log(bcbaToken);
          console.log(`User ID: ${bcbaUser.id}, Name: ${bcbaUser.firstName} ${bcbaUser.lastName}\n`);
        } else {
          console.log('No BCBA user found in database.\n');
        }
        
        // If no users found, fall back to mock tokens
        if (!adminUser && !bcbaUser) {
          fallbackToMockTokens();
        }
        
        return;
      }
    } catch (error) {
      console.error('Error accessing database:', error);
      console.log('Falling back to mock tokens...\n');
    }
  }
  
  // If we reach here, use mock tokens
  fallbackToMockTokens();
};

// Create mock tokens when database users are not available
const fallbackToMockTokens = () => {
  // Admin token
  const adminToken = createToken('1');
  console.log('Admin Token (MOCK):');
  console.log(adminToken);

  // BCBA token
  const bcbaToken = createToken('2');
  console.log('\nBCBA Token (MOCK):');
  console.log(bcbaToken);
};

console.log('\nAdd to localStorage with:');
console.log("localStorage.setItem('token', 'TOKEN_VALUE');");

// Run the token generator
generateTokens()
  .catch(err => {
    console.error('Error generating tokens:', err);
  })
  .finally(() => {
    // Close database connection if it was opened
    if (db && db.sequelize) {
      db.sequelize.close();
    }
  });