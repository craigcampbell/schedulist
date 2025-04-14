require('dotenv').config();
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

async function createTestAppointments() {
  console.log('Connecting to database...');
  const pool = new Pool(dbConfig);

  try {
    // Get a therapist
    const therapistQuery = await pool.query(
      'SELECT id FROM "Users" LIMIT 1'
    );
    
    if (therapistQuery.rowCount === 0) {
      console.log('No therapists found in the database');
      return;
    }
    
    const therapistId = therapistQuery.rows[0].id;
    
    // Get a patient
    const patientQuery = await pool.query(
      'SELECT id FROM "Patients" LIMIT 1'
    );
    
    if (patientQuery.rowCount === 0) {
      console.log('No patients found in the database');
      return;
    }
    
    const patientId = patientQuery.rows[0].id;
    
    // Get a location
    const locationQuery = await pool.query(
      'SELECT id FROM "Locations" LIMIT 1'
    );
    
    if (locationQuery.rowCount === 0) {
      console.log('No locations found in the database');
      return;
    }
    
    const locationId = locationQuery.rows[0].id;
    
    // Create 10 sample appointments
    const now = new Date();
    
    for (let i = 0; i < 10; i++) {
      const appointmentDate = new Date(now);
      appointmentDate.setDate(now.getDate() + i);
      appointmentDate.setHours(9 + i % 8, 0, 0, 0); // 9am to 4pm
      
      const endTime = new Date(appointmentDate);
      endTime.setHours(endTime.getHours() + 1); // 1 hour appointments
      
      const appointmentId = crypto.randomUUID();
      
      await pool.query(
        `INSERT INTO "Appointments" 
         (id, "startTime", "endTime", title, status, notes, recurring, "recurringPattern", "therapistId", "patientId", "locationId", "createdAt", "updatedAt")
         VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          appointmentId,
          appointmentDate.toISOString(),
          endTime.toISOString(),
          'Therapy Session',
          'scheduled',
          'Test appointment',
          false,
          null,
          therapistId,
          patientId,
          locationId,
          now,
          now
        ]
      );
      
      console.log(`Created appointment for ${appointmentDate.toDateString()} at ${appointmentDate.getHours()}:00`);
    }
    
    console.log('Created 10 test appointments');
    
  } catch (error) {
    console.error('Error creating test appointments:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

createTestAppointments();