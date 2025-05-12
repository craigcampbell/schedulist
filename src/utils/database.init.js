const db = require('../models');
const bcrypt = require('bcrypt');

// Initialize database with default roles and admin user
const initDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Sync all models
    await db.sequelize.sync({ force: true });
    console.log('Database tables created');
    
    // Create roles
    const roles = [
      { name: 'admin', description: 'System administrator with full access' },
      { name: 'bcba', description: 'Board Certified Behavior Analyst' },
      { name: 'therapist', description: 'ABA Therapist' }
    ];
    
    const createdRoles = await Promise.all(
      roles.map(role => db.Role.create(role))
    );
    
    console.log('Default roles created');
    
    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const adminUser = await db.User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: hashedPassword,
      active: true
    });
    
    // Assign admin role
    await adminUser.addRole(createdRoles[0]);
    
    console.log('Admin user created:');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    
    // Create BCBA user
    const bcbaUser = await db.User.create({
      firstName: 'Test',
      lastName: 'BCBA',
      email: 'bcba@example.com',
      password: hashedPassword,
      active: true
    });
    
    // Assign BCBA role
    await bcbaUser.addRole(createdRoles[1]);
    
    console.log('BCBA user created:');
    console.log('Email: bcba@example.com');
    console.log('Password: admin123');
    
    // Create therapist user
    const therapistUser = await db.User.create({
      firstName: 'Test',
      lastName: 'Therapist',
      email: 'therapist@example.com',
      password: hashedPassword,
      active: true
    });
    
    // Assign therapist role
    await therapistUser.addRole(createdRoles[2]);
    
    console.log('Therapist user created:');
    console.log('Email: therapist@example.com');
    console.log('Password: admin123');
    
    // Create a location
    const location = await db.Location.create({
      name: 'Main Clinic',
      address: '123 Therapy Lane',
      city: 'Therapyville',
      state: 'CA',
      zipCode: '90210',
      phone: '555-123-4567',
      active: true
    });
    
    console.log('Default location created');
    
    // Create some test patients
    const patient1 = await db.Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2018-01-15',
      insuranceProvider: 'Blue Cross',
      insuranceId: 'BC123456789',
      phone: '555-987-6543',
      address: '456 Patient St, Therapyville, CA 90210',
      requiredWeeklyHours: 20,
      status: 'active'
    });
    
    const patient2 = await db.Patient.create({
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '2019-03-22',
      insuranceProvider: 'Aetna',
      insuranceId: 'AE987654321',
      phone: '555-456-7890',
      address: '789 Client Ave, Therapyville, CA 90210',
      requiredWeeklyHours: 15,
      status: 'active'
    });
    
    console.log('Test patients created');
    
    // Assign patients to BCBA and therapist
    await bcbaUser.addPatient(patient1);
    await bcbaUser.addPatient(patient2);
    await therapistUser.addPatient(patient1);
    
    console.log('Patients assigned to providers');
    
    // Create some test appointments
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    const appointment1 = await db.Appointment.create({
      startTime: new Date(tomorrow),
      endTime: new Date(tomorrow.setHours(10, 0, 0, 0)),
      title: 'Morning Session',
      status: 'scheduled',
      therapistId: therapistUser.id,
      patientId: patient1.id,
      locationId: location.id
    });
    
    tomorrow.setHours(13, 0, 0, 0);
    
    const appointment2 = await db.Appointment.create({
      startTime: new Date(tomorrow),
      endTime: new Date(tomorrow.setHours(14, 0, 0, 0)),
      title: 'Afternoon Session',
      status: 'scheduled',
      therapistId: bcbaUser.id,
      patientId: patient2.id,
      locationId: location.id
    });
    
    console.log('Test appointments created');
    
    // Create a test note
    const note = await db.Note.create({
      content: 'Patient showed improved interaction during today\'s session.',
      noteType: 'session',
      sessionDate: new Date(),
      authorId: therapistUser.id,
      patientId: patient1.id
    });
    
    console.log('Test note created');
    
    console.log('Database initialization completed successfully');
    
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    process.exit();
  }
};

// Run the initialization
initDatabase();