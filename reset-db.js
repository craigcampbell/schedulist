require('dotenv').config();
const { Pool } = require('pg');
const { exec } = require('child_process');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'schedulist',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function resetDatabase() {
  console.log('Connecting to database...');
  const pool = new Pool(dbConfig);

  try {
    console.log('Getting list of all tables...');
    const tableQuery = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    const tables = tableQuery.rows.map(row => row.tablename);
    
    if (tables.length > 0) {
      console.log(`Found ${tables.length} tables to drop: ${tables.join(', ')}`);
      
      // Disable foreign key checks for the session
      await pool.query('SET session_replication_role = replica;');
      
      // Drop each table
      for (const table of tables) {
        try {
          console.log(`Dropping table "${table}"...`);
          await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        } catch (err) {
          console.error(`Error dropping table "${table}":`, err);
        }
      }
      
      // Re-enable foreign key checks
      await pool.query('SET session_replication_role = default;');
      
      console.log('All tables dropped successfully');
    } else {
      console.log('No tables found in the database');
    }
    
    // Run the seed script
    console.log('\nRunning seed script...');
    exec('node schedulist/utils/seed-data.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing seed script: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Seed script stderr: ${stderr}`);
        return;
      }
      console.log(stdout);
      console.log('Database has been reset and reseeded successfully!');
    });
    
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
resetDatabase();