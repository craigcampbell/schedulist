require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const crypto = require('crypto');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'schedulist',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function createTestLogin() {
  console.log('Connecting to database...');
  const pool = new Pool(dbConfig);

  try {
    // Check if our test user exists
    const userEmail = 'admin@test.com';
    const checkUser = await pool.query(
      'SELECT id FROM "Users" WHERE email = $1',
      [userEmail]
    );

    let userId;
    if (checkUser.rows.length === 0) {
      console.log('Creating new test user...');
      
      // Create user
      const insertUser = await pool.query(
        `INSERT INTO "Users" 
         (id, "firstName", "lastName", email, password, active, "isSuperAdmin", "createdAt", "updatedAt")
         VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          crypto.randomUUID(), // id
          'Test',              // firstName
          'Admin',             // lastName
          userEmail,           // email
          'Password123',       // password - IMPORTANT: Using plain text for now
          true,                // active
          true,                // isSuperAdmin
          new Date(),          // createdAt
          new Date()           // updatedAt
        ]
      );
      
      userId = insertUser.rows[0].id;
      console.log('User created with ID:', userId);
      
      // Get Admin role ID
      const adminRole = await pool.query(
        'SELECT id FROM "Roles" WHERE name = $1',
        ['admin']
      );
      
      if (adminRole.rows.length > 0) {
        const roleId = adminRole.rows[0].id;
        
        // Associate user with admin role
        await pool.query(
          `INSERT INTO "UserRoles" 
           ("UserId", "RoleId", "createdAt", "updatedAt")
           VALUES 
           ($1, $2, $3, $4)`,
          [
            userId,      // UserId
            roleId,      // RoleId
            new Date(),  // createdAt
            new Date()   // updatedAt
          ]
        );
        
        console.log('User assigned admin role');
      } else {
        console.log('Admin role not found');
      }
    } else {
      userId = checkUser.rows[0].id;
      console.log('Test user already exists, updating password...');
      
      // Update the user's password to a known plain text value
      await pool.query(
        'UPDATE "Users" SET password = $1 WHERE id = $2',
        ['Password123', userId] 
      );
    }

    console.log('Test user is ready to use:');
    console.log('Email: admin@test.com');
    console.log('Password: Password123');
    console.log('');
    console.log('IMPORTANT: This user has a plain text password so it will work with the current login system.');
    console.log('For production, you should fix the password hashing in the seed script.');

  } catch (error) {
    console.error('Error creating test login:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

createTestLogin();