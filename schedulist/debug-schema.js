const { sequelize } = require('./src/models');

async function debugSchema() {
  try {
    // Check the actual database schema
    const [appointmentSchema] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Appointments' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Appointments table schema:');
    appointmentSchema.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    const [patientSchema] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Patients' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nPatients table schema:');
    patientSchema.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // Check for foreign key constraints
    const [fkConstraints] = await sequelize.query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'Appointments';
    `);
    
    console.log('\nForeign key constraints for Appointments:');
    fkConstraints.forEach(fk => {
      console.log(`- ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    
    // Test the relationship manually with raw SQL
    const [rawJoin] = await sequelize.query(`
      SELECT 
        a.id as appointment_id,
        a."patientId" as appointment_patient_id,
        p.id as patient_id,
        p."encryptedFirstName" as patient_name
      FROM "Appointments" a
      LEFT JOIN "Patients" p ON a."patientId" = p.id
      LIMIT 5;
    `);
    
    console.log('\nRaw SQL join test:');
    rawJoin.forEach(row => {
      console.log(`- Appointment ${row.appointment_id.substring(0,8)}... -> Patient ${row.patient_id ? row.patient_id.substring(0,8) + '...' : 'NULL'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugSchema();