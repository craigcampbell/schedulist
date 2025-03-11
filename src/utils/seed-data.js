const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
const db = require('../models');
const { encrypt } = require('./encryption');
const { addDays, subDays, addHours } = require('date-fns');

// Number of users and entities to create
const NUM_ADMINS = 2;
const NUM_BCBAS = 5;
const NUM_THERAPISTS = 10;
const NUM_PATIENTS = 30;
const NUM_LOCATIONS = 3;
const APPOINTMENTS_PER_PATIENT = 5;
const NOTES_PER_PATIENT = 3;

// Test user information - for easy login during testing
const TEST_USERS = {
  admin: {
    firstName: 'Test',
    lastName: 'Admin',
    email: 'admin@test.com',
    password: 'Password123'
  },
  bcba: {
    firstName: 'Test',
    lastName: 'BCBA',
    email: 'bcba@test.com',
    password: 'Password123'
  },
  therapist: {
    firstName: 'Test',
    lastName: 'Therapist',
    email: 'therapist@test.com',
    password: 'Password123'
  }
};

// Initialize database with seed data
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');
    
    // Sync all models - CAUTION: { force: true } will drop existing tables
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
    
    // Get created roles by name
    const adminRole = createdRoles.find(role => role.name === 'admin');
    const bcbaRole = createdRoles.find(role => role.name === 'bcba');
    const therapistRole = createdRoles.find(role => role.name === 'therapist');
    
    // Create test users for easy login
    const testAdmin = await createUser(TEST_USERS.admin);
    await testAdmin.addRole(adminRole);
    console.log(`Test admin created: ${TEST_USERS.admin.email} / ${TEST_USERS.admin.password}`);
    
    const testBcba = await createUser(TEST_USERS.bcba);
    await testBcba.addRole(bcbaRole);
    console.log(`Test BCBA created: ${TEST_USERS.bcba.email} / ${TEST_USERS.bcba.password}`);
    
    const testTherapist = await createUser(TEST_USERS.therapist);
    await testTherapist.addRole(therapistRole);
    console.log(`Test therapist created: ${TEST_USERS.therapist.email} / ${TEST_USERS.therapist.password}`);
    
    // Create random admins
    const admins = await Promise.all(
      Array(NUM_ADMINS).fill().map(async () => {
        const user = await createUser();
        await user.addRole(adminRole);
        return user;
      })
    );
    console.log(`Created ${admins.length} additional admin users`);
    
    // Create random BCBAs
    const bcbas = await Promise.all(
      Array(NUM_BCBAS).fill().map(async () => {
        const user = await createUser();
        await user.addRole(bcbaRole);
        return user;
      })
    );
    console.log(`Created ${bcbas.length} additional BCBA users`);
    
    // Create random therapists
    const therapists = await Promise.all(
      Array(NUM_THERAPISTS).fill().map(async () => {
        const user = await createUser();
        await user.addRole(therapistRole);
        return user;
      })
    );
    console.log(`Created ${therapists.length} additional therapist users`);
    
    // Create random locations
    const locations = await Promise.all(
      Array(NUM_LOCATIONS).fill().map(() => createLocation())
    );
    console.log(`Created ${locations.length} locations`);
    
    // Create random patients
    const patients = await Promise.all(
      Array(NUM_PATIENTS).fill().map(() => createPatient())
    );
    console.log(`Created ${patients.length} patients`);
    
    // Assign patients to BCBAs and therapists
    for (const patient of patients) {
      // Assign to 1 or 2 BCBAs
      const numBcbas = Math.random() > 0.7 ? 2 : 1;
      const selectedBcbas = getRandomElements([...bcbas, testBcba], numBcbas);
      await patient.addAssignees(selectedBcbas);
      
      // Assign to 1-3 therapists
      const numTherapists = Math.floor(Math.random() * 3) + 1;
      const selectedTherapists = getRandomElements([...therapists, testTherapist], numTherapists);
      await patient.addAssignees(selectedTherapists);
    }
    console.log('Assigned patients to BCBAs and therapists');
    
    // Create appointments for each patient
    const allAppointments = [];
    for (const patient of patients) {
      const patientAssignees = await patient.getAssignees();
      const patientTherapists = patientAssignees.filter(user => 
        user.Roles?.some(role => role.name === 'therapist') || 
        user.id === testTherapist.id
      );
      
      if (patientTherapists.length === 0) continue;
      
      const appointments = await Promise.all(
        Array(APPOINTMENTS_PER_PATIENT).fill().map(() => 
          createAppointment(patient, patientTherapists, locations)
        )
      );
      allAppointments.push(...appointments);
    }
    console.log(`Created ${allAppointments.length} appointments`);
    
    // Create notes for each patient
    const allNotes = [];
    for (const patient of patients) {
      const patientAssignees = await patient.getAssignees();
      const notesCreators = patientAssignees;
      
      if (notesCreators.length === 0) continue;
      
      const notes = await Promise.all(
        Array(NOTES_PER_PATIENT).fill().map(() => 
          createNote(patient, notesCreators)
        )
      );
      allNotes.push(...notes);
    }
    console.log(`Created ${allNotes.length} clinical notes`);
    
    // Create specific appointments for test users to ensure they have data to view
    // Ensure test therapist has appointments today and this week
    const testTherapistAppointments = await Promise.all([
      // Today's appointment
      createSpecificAppointment(
        patients[0], 
        testTherapist, 
        locations[0],
        new Date(),
        1  // 1 hour duration
      ),
      // Tomorrow's appointment
      createSpecificAppointment(
        patients[1], 
        testTherapist, 
        locations[0],
        addDays(new Date(), 1),
        1.5  // 1.5 hours duration
      ),
      // Later this week
      createSpecificAppointment(
        patients[2], 
        testTherapist, 
        locations[1],
        addDays(new Date(), 3),
        2  // 2 hours duration
      )
    ]);
    
    // Ensure test BCBA can see appointments for therapists they supervise
    const testBcbaPatients = patients.slice(0, 5);
    await testBcba.addPatients(testBcbaPatients);
    
    // Add notes for test therapist
    await Promise.all(
      testBcbaPatients.map(patient => 
        createSpecificNote(
          patient,
          testTherapist,
          'session',
          faker.lorem.paragraph(5),
          subDays(new Date(), Math.floor(Math.random() * 10))
        )
      )
    );
    
    console.log('Database seeding completed successfully');
    console.log('\nTest account credentials:');
    console.log('-------------------------');
    console.log(`Admin:     ${TEST_USERS.admin.email} / ${TEST_USERS.admin.password}`);
    console.log(`BCBA:      ${TEST_USERS.bcba.email} / ${TEST_USERS.bcba.password}`);
    console.log(`Therapist: ${TEST_USERS.therapist.email} / ${TEST_USERS.therapist.password}`);
    
    return {
      success: true,
      testCredentials: {
        admin: TEST_USERS.admin,
        bcba: TEST_USERS.bcba,
        therapist: TEST_USERS.therapist
      }
    };
    
  } catch (error) {
    console.error('Database seeding error:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    process.exit();
  }
};

// Helper function to create a random user
async function createUser(userData = null) {
  const salt = await bcrypt.genSalt(10);
  
  if (userData) {
    // If user data is provided, use it (for test users)
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    return await db.User.create({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      password: hashedPassword,
      phone: faker.phone.number(),
      active: true
    });
  }
  
  // Otherwise create a random user
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet.email({ firstName, lastName }).toLowerCase();
  const password = faker.internet.password({ length: 10 });
  const hashedPassword = await bcrypt.hash(password, salt);
  
  return await db.User.create({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    phone: faker.phone.number(),
    active: true
  });
}

// Helper function to create a random location
async function createLocation() {
  return await db.Location.create({
    name: faker.company.name() + ' Clinic',
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode(),
    phone: faker.phone.number(),
    active: true
  });
}

// Helper function to create a random patient
async function createPatient() {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const dateOfBirth = faker.date.birthdate({ min: 2, max: 18 });
  const insuranceProvider = faker.helpers.arrayElement([
    'Blue Cross', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Humana', 'Kaiser', 'Medicare', 'Medicaid'
  ]);
  
  return await db.Patient.create({
    firstName,
    lastName,
    dateOfBirth: dateOfBirth.toISOString(),
    insuranceProvider,
    insuranceId: faker.finance.accountNumber(),
    phone: faker.phone.number(),
    address: faker.location.streetAddress() + ', ' + faker.location.city() + ', ' + faker.location.state() + ' ' + faker.location.zipCode(),
    requiredWeeklyHours: faker.helpers.arrayElement([5, 10, 15, 20, 25, 30]),
    status: faker.helpers.arrayElement(['active', 'active', 'active', 'inactive'])
  });
}

// Helper function to create a random appointment
async function createAppointment(patient, therapists, locations) {
  const therapist = faker.helpers.arrayElement(therapists);
  const location = faker.helpers.arrayElement(locations);
  const startDate = faker.date.soon({ days: 14 });
  const durationHours = faker.helpers.arrayElement([1, 1.5, 2]);
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
  
  return await db.Appointment.create({
    startTime: startDate,
    endTime: endDate,
    title: faker.helpers.arrayElement(['Therapy Session', 'Assessment', 'Parent Meeting', 'Skills Training']),
    status: faker.helpers.arrayElement(['scheduled', 'scheduled', 'scheduled', 'completed', 'cancelled']),
    notes: Math.random() > 0.5 ? faker.lorem.sentence() : null,
    recurring: Math.random() > 0.8,
    recurringPattern: Math.random() > 0.8 ? { frequency: 'weekly', day: startDate.getDay() } : null,
    therapistId: therapist.id,
    patientId: patient.id,
    locationId: location.id
  });
}

// Helper function to create a specific appointment for testing
async function createSpecificAppointment(patient, therapist, location, baseDate, durationHours) {
  // Set to a reasonable hour (9am-5pm)
  const hour = 9 + Math.floor(Math.random() * 8);
  const startDate = new Date(baseDate);
  startDate.setHours(hour, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setHours(startDate.getHours() + Math.floor(durationHours));
  endDate.setMinutes((durationHours % 1) * 60);
  
  return await db.Appointment.create({
    startTime: startDate,
    endTime: endDate,
    title: faker.helpers.arrayElement(['Therapy Session', 'Assessment', 'Parent Meeting', 'Skills Training']),
    status: 'scheduled',
    notes: faker.lorem.sentence(),
    recurring: false,
    therapistId: therapist.id,
    patientId: patient.id,
    locationId: location.id
  });
}

// Helper function to create a random note
async function createNote(patient, users) {
  const author = faker.helpers.arrayElement(users);
  const noteType = faker.helpers.arrayElement(['session', 'progress', 'assessment', 'general']);
  const sessionDate = faker.date.recent({ days: 30 });
  
  return await db.Note.create({
    content: faker.lorem.paragraphs(2),
    noteType,
    sessionDate,
    authorId: author.id,
    patientId: patient.id
  });
}

// Helper function to create a specific note for testing
async function createSpecificNote(patient, author, noteType, content, sessionDate) {
  return await db.Note.create({
    content,
    noteType,
    sessionDate,
    authorId: author.id,
    patientId: patient.id
  });
}

// Helper function to get random elements from an array
function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

// Export the seeder
module.exports = seedDatabase;

// Run if this file is executed directly
if (require.main === module) {
  seedDatabase();
}