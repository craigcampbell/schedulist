const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../src/models');
const { addDays, subDays, addHours, addMonths, subMonths } = require('date-fns');

// Number of users and entities to create
const NUM_ADMINS = 2;
const NUM_BCBAS = 5;
const NUM_THERAPISTS = 10;
const NUM_PATIENTS = 30;
const NUM_LOCATIONS = 3;
const APPOINTMENTS_PER_PATIENT = 5;
const NOTES_PER_PATIENT = 3;

// Organization data
const ORGANIZATIONS = {
  active: {
    name: 'Sunshine Therapy',
    slug: 'sunshine',
    active: true,
    subscriptionActive: true,
    subscriptionTier: 'standard',
    subscriptionStartDate: subMonths(new Date(), 3),
    subscriptionEndDate: addMonths(new Date(), 9),
    paidLocationsCount: 2,
    includedUsersCount: 10,
    additionalUsersCount: 5,
    monthlyRate: 20.00,
    logoUrl: 'https://placehold.co/400x200/FFC107/000000?text=Sunshine+Therapy'
  },
  expiring: {
    name: 'Healing Hearts',
    slug: 'healing-hearts',
    active: true,
    subscriptionActive: true,
    subscriptionTier: 'standard',
    subscriptionStartDate: subMonths(new Date(), 11),
    subscriptionEndDate: addDays(new Date(), 5), // Expires in 5 days
    paidLocationsCount: 1,
    includedUsersCount: 5,
    additionalUsersCount: 2,
    monthlyRate: 12.00,
    logoUrl: 'https://placehold.co/400x200/E91E63/FFFFFF?text=Healing+Hearts'
  },
  inactive: {
    name: 'Coastal Behavior',
    slug: 'coastal',
    active: true,
    subscriptionActive: false,
    subscriptionTier: 'free',
    subscriptionStartDate: subMonths(new Date(), 13),
    subscriptionEndDate: subMonths(new Date(), 1),
    paidLocationsCount: 0,
    includedUsersCount: 0,
    additionalUsersCount: 0,
    monthlyRate: 0.00,
    logoUrl: 'https://placehold.co/400x200/2196F3/FFFFFF?text=Coastal+Behavior'
  }
};

// Test user information - for easy login during testing
const TEST_USERS = {
  // Organization 1 - Active subscription
  sunshineAdmin: {
    firstName: 'Sarah',
    lastName: 'Admin',
    email: 'admin@sunshine.com',
    password: 'Password123',
    organization: 'active'
  },
  sunshineBCBA: {
    firstName: 'Brian',
    lastName: 'BCBA',
    email: 'bcba@sunshine.com',
    password: 'Password123',
    organization: 'active'
  },
  sunshineTherapist: {
    firstName: 'Tina',
    lastName: 'Therapist',
    email: 'therapist@sunshine.com',
    password: 'Password123',
    organization: 'active'
  },
  
  // Organization 2 - Expiring subscription
  heartsAdmin: {
    firstName: 'Henry',
    lastName: 'Admin',
    email: 'admin@hearts.com',
    password: 'Password123',
    organization: 'expiring'
  },
  heartsBCBA: {
    firstName: 'Bella',
    lastName: 'BCBA',
    email: 'bcba@hearts.com',
    password: 'Password123',
    organization: 'expiring'
  },
  heartsTherapist: {
    firstName: 'Theo',
    lastName: 'Therapist',
    email: 'therapist@hearts.com',
    password: 'Password123',
    organization: 'expiring'
  },
  
  // Organization 3 - Inactive subscription
  coastalAdmin: {
    firstName: 'Chris',
    lastName: 'Admin',
    email: 'admin@coastal.com',
    password: 'Password123',
    organization: 'inactive'
  },
  coastalBCBA: {
    firstName: 'Beth',
    lastName: 'BCBA',
    email: 'bcba@coastal.com',
    password: 'Password123',
    organization: 'inactive'
  },
  coastalTherapist: {
    firstName: 'Trevor',
    lastName: 'Therapist',
    email: 'therapist@coastal.com',
    password: 'Password123',
    organization: 'inactive'
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
    
    // Create organizations
    const createdOrgs = {};
    
    for (const [key, orgData] of Object.entries(ORGANIZATIONS)) {
      const organization = await db.Organization.create(orgData);
      createdOrgs[key] = organization;
      console.log(`Created organization: ${organization.name} (${organization.slug})`);
    }
    
    // Create test users for each organization
    const createdUsers = {};
    
    // Organization 1 - Active subscription (Sunshine Therapy)
    createdUsers.sunshineAdmin = await createUserWithOrg(
      TEST_USERS.sunshineAdmin, 
      createdOrgs.active.id,
      adminRole
    );
    
    createdUsers.sunshineBCBA = await createUserWithOrg(
      TEST_USERS.sunshineBCBA,
      createdOrgs.active.id,
      bcbaRole
    );
    
    createdUsers.sunshineTherapist = await createUserWithOrg(
      TEST_USERS.sunshineTherapist,
      createdOrgs.active.id,
      therapistRole
    );
    
    // Organization 2 - Expiring subscription (Healing Hearts)  
    createdUsers.heartsAdmin = await createUserWithOrg(
      TEST_USERS.heartsAdmin,
      createdOrgs.expiring.id,
      adminRole
    );
    
    createdUsers.heartsBCBA = await createUserWithOrg(
      TEST_USERS.heartsBCBA,
      createdOrgs.expiring.id,
      bcbaRole
    );
    
    createdUsers.heartsTherapist = await createUserWithOrg(
      TEST_USERS.heartsTherapist,
      createdOrgs.expiring.id,
      therapistRole
    );
    
    // Organization 3 - Inactive subscription (Coastal Behavior)
    createdUsers.coastalAdmin = await createUserWithOrg(
      TEST_USERS.coastalAdmin,
      createdOrgs.inactive.id,
      adminRole
    );
    
    createdUsers.coastalBCBA = await createUserWithOrg(
      TEST_USERS.coastalBCBA,
      createdOrgs.inactive.id,
      bcbaRole
    );
    
    createdUsers.coastalTherapist = await createUserWithOrg(
      TEST_USERS.coastalTherapist,
      createdOrgs.inactive.id,
      therapistRole
    );
    
    console.log('Created test users for all organizations');
    
    // Create additional users for each organization
    const orgAdditionalUsers = {
      active: {
        admins: [],
        bcbas: [],
        therapists: []
      },
      expiring: {
        admins: [],
        bcbas: [],
        therapists: []
      },
      inactive: {
        admins: [],
        bcbas: [],
        therapists: []
      }
    };
    
    // Create additional users for active organization (Sunshine)
    orgAdditionalUsers.active.admins = await Promise.all(
      Array(1).fill().map(async () => {
        const user = await createUser(null, createdOrgs.active.id);
        await user.addRole(adminRole);
        return user;
      })
    );
    
    orgAdditionalUsers.active.bcbas = await Promise.all(
      Array(3).fill().map(async () => {
        const user = await createUser(null, createdOrgs.active.id);
        await user.addRole(bcbaRole);
        return user;
      })
    );
    
    orgAdditionalUsers.active.therapists = await Promise.all(
      Array(8).fill().map(async () => {
        const user = await createUser(null, createdOrgs.active.id);
        await user.addRole(therapistRole);
        return user;
      })
    );
    
    // Create additional users for expiring organization (Hearts)
    orgAdditionalUsers.expiring.bcbas = await Promise.all(
      Array(2).fill().map(async () => {
        const user = await createUser(null, createdOrgs.expiring.id);
        await user.addRole(bcbaRole);
        return user;
      })
    );
    
    orgAdditionalUsers.expiring.therapists = await Promise.all(
      Array(4).fill().map(async () => {
        const user = await createUser(null, createdOrgs.expiring.id);
        await user.addRole(therapistRole);
        return user;
      })
    );
    
    // Create additional users for inactive organization (Coastal)
    orgAdditionalUsers.inactive.bcbas = await Promise.all(
      Array(2).fill().map(async () => {
        const user = await createUser(null, createdOrgs.inactive.id);
        await user.addRole(bcbaRole);
        return user;
      })
    );
    
    orgAdditionalUsers.inactive.therapists = await Promise.all(
      Array(3).fill().map(async () => {
        const user = await createUser(null, createdOrgs.inactive.id);
        await user.addRole(therapistRole);
        return user;
      })
    );
    
    console.log('Created additional users for all organizations');
    
    // Create locations for each organization
    const orgLocations = {
      active: [],
      expiring: [],
      inactive: []
    };
    
    // Create locations for active organization (Sunshine)
    orgLocations.active = await Promise.all(
      Array(3).fill().map(() => createLocation(createdOrgs.active.id))
    );
    
    // Create locations for expiring organization (Hearts)
    orgLocations.expiring = await Promise.all(
      Array(2).fill().map(() => createLocation(createdOrgs.expiring.id))
    );
    
    // Create locations for inactive organization (Coastal)
    orgLocations.inactive = await Promise.all(
      Array(1).fill().map(() => createLocation(createdOrgs.inactive.id))
    );
    
    console.log('Created locations for all organizations');
    
    // Create patients for each organization
    const orgPatients = {
      active: [],
      expiring: [],
      inactive: []
    };
    
    // Create patients for active organization (Sunshine)
    orgPatients.active = await Promise.all(
      Array(15).fill().map(() => createPatient(createdOrgs.active.id))
    );
    
    // Create patients for expiring organization (Hearts)
    orgPatients.expiring = await Promise.all(
      Array(10).fill().map(() => createPatient(createdOrgs.expiring.id))
    );
    
    // Create patients for inactive organization (Coastal)
    orgPatients.inactive = await Promise.all(
      Array(5).fill().map(() => createPatient(createdOrgs.inactive.id))
    );
    
    console.log('Created patients for all organizations');
    
    // Assign patients to BCBAs and therapists for each organization
    // Active organization (Sunshine)
    const activeBCBAs = [createdUsers.sunshineBCBA, ...orgAdditionalUsers.active.bcbas];
    const activeTherapists = [createdUsers.sunshineTherapist, ...orgAdditionalUsers.active.therapists];
    
    for (const patient of orgPatients.active) {
      // Assign to 1 or 2 BCBAs
      const numBcbas = Math.random() > 0.7 ? 2 : 1;
      const selectedBcbas = getRandomElements(activeBCBAs, numBcbas);
      await patient.addAssignees(selectedBcbas);
      
      // Set one BCBA as primary
      const primaryBcba = selectedBcbas[0]; // First selected BCBA becomes primary
      patient.primaryBcbaId = primaryBcba.id;
      await patient.save();
      
      // Assign to 1-3 therapists
      const numTherapists = Math.floor(Math.random() * 3) + 1;
      const selectedTherapists = getRandomElements(activeTherapists, numTherapists);
      await patient.addAssignees(selectedTherapists);
    }
    
    // Expiring organization (Hearts)
    const expiringBCBAs = [createdUsers.heartsBCBA, ...orgAdditionalUsers.expiring.bcbas];
    const expiringTherapists = [createdUsers.heartsTherapist, ...orgAdditionalUsers.expiring.therapists];
    
    for (const patient of orgPatients.expiring) {
      // Assign to 1 or 2 BCBAs
      const numBcbas = Math.random() > 0.7 ? 2 : 1;
      const selectedBcbas = getRandomElements(expiringBCBAs, numBcbas);
      await patient.addAssignees(selectedBcbas);
      
      // Set one BCBA as primary
      const primaryBcba = selectedBcbas[0]; // First selected BCBA becomes primary
      patient.primaryBcbaId = primaryBcba.id;
      await patient.save();
      
      // Assign to 1-3 therapists
      const numTherapists = Math.floor(Math.random() * 3) + 1;
      const selectedTherapists = getRandomElements(expiringTherapists, numTherapists);
      await patient.addAssignees(selectedTherapists);
    }
    
    // Inactive organization (Coastal)
    const inactiveBCBAs = [createdUsers.coastalBCBA, ...orgAdditionalUsers.inactive.bcbas];
    const inactiveTherapists = [createdUsers.coastalTherapist, ...orgAdditionalUsers.inactive.therapists];
    
    for (const patient of orgPatients.inactive) {
      // Assign to 1 or 2 BCBAs
      const numBcbas = Math.random() > 0.7 ? 2 : 1;
      const selectedBcbas = getRandomElements(inactiveBCBAs, numBcbas);
      await patient.addAssignees(selectedBcbas);
      
      // Set one BCBA as primary
      const primaryBcba = selectedBcbas[0]; // First selected BCBA becomes primary
      patient.primaryBcbaId = primaryBcba.id;
      await patient.save();
      
      // Assign to 1-3 therapists
      const numTherapists = Math.floor(Math.random() * 3) + 1;
      const selectedTherapists = getRandomElements(inactiveTherapists, numTherapists);
      await patient.addAssignees(selectedTherapists);
    }
    
    console.log('Assigned patients to BCBAs and therapists for all organizations');
    
    // Create appointments for each organization
    // Active organization (Sunshine)
    let allAppointments = [];
    for (const patient of orgPatients.active) {
      const patientAssignees = await patient.getAssignees();
      const patientTherapists = patientAssignees.filter(user => 
        user.Roles?.some(role => role.name === 'therapist')
      );
      
      if (patientTherapists.length === 0) continue;
      
      const appointments = await Promise.all(
        Array(APPOINTMENTS_PER_PATIENT).fill().map(() => 
          createAppointment(patient, patientTherapists, orgLocations.active)
        )
      );
      allAppointments.push(...appointments);
    }
    
    // Expiring organization (Hearts)
    for (const patient of orgPatients.expiring) {
      const patientAssignees = await patient.getAssignees();
      const patientTherapists = patientAssignees.filter(user => 
        user.Roles?.some(role => role.name === 'therapist')
      );
      
      if (patientTherapists.length === 0) continue;
      
      const appointments = await Promise.all(
        Array(APPOINTMENTS_PER_PATIENT).fill().map(() => 
          createAppointment(patient, patientTherapists, orgLocations.expiring)
        )
      );
      allAppointments.push(...appointments);
    }
    
    // Inactive organization (Coastal)
    for (const patient of orgPatients.inactive) {
      const patientAssignees = await patient.getAssignees();
      const patientTherapists = patientAssignees.filter(user => 
        user.Roles?.some(role => role.name === 'therapist')
      );
      
      if (patientTherapists.length === 0) continue;
      
      const appointments = await Promise.all(
        Array(Math.floor(APPOINTMENTS_PER_PATIENT / 2)).fill().map(() => 
          createAppointment(patient, patientTherapists, orgLocations.inactive)
        )
      );
      allAppointments.push(...appointments);
    }
    
    console.log(`Created ${allAppointments.length} appointments across all organizations`);
    
    // Create notes for each organization
    // Active organization (Sunshine)
    let allNotes = [];
    for (const patient of orgPatients.active) {
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
    
    // Expiring organization (Hearts)
    for (const patient of orgPatients.expiring) {
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
    
    // Inactive organization (Coastal)
    for (const patient of orgPatients.inactive) {
      const patientAssignees = await patient.getAssignees();
      const notesCreators = patientAssignees;
      
      if (notesCreators.length === 0) continue;
      
      const notes = await Promise.all(
        Array(Math.floor(NOTES_PER_PATIENT / 2)).fill().map(() => 
          createNote(patient, notesCreators)
        )
      );
      allNotes.push(...notes);
    }
    
    console.log(`Created ${allNotes.length} clinical notes across all organizations`);
    
    // Create specific appointments for test users to ensure they have data to view
    // Ensure test therapists have appointments today and this week
    // Active organization (Sunshine)
    await Promise.all([
      // Today's appointment
      createSpecificAppointment(
        orgPatients.active[0], 
        createdUsers.sunshineTherapist, 
        orgLocations.active[0],
        new Date(),
        1  // 1 hour duration
      ),
      // Tomorrow's appointment
      createSpecificAppointment(
        orgPatients.active[1], 
        createdUsers.sunshineTherapist, 
        orgLocations.active[0],
        addDays(new Date(), 1),
        1.5  // 1.5 hours duration
      ),
      // Later this week
      createSpecificAppointment(
        orgPatients.active[2], 
        createdUsers.sunshineTherapist, 
        orgLocations.active[1],
        addDays(new Date(), 3),
        2  // 2 hours duration
      )
    ]);
    
    // Expiring organization (Hearts)
    await Promise.all([
      // Today's appointment
      createSpecificAppointment(
        orgPatients.expiring[0], 
        createdUsers.heartsTherapist, 
        orgLocations.expiring[0],
        new Date(),
        1  // 1 hour duration
      ),
      // Tomorrow's appointment
      createSpecificAppointment(
        orgPatients.expiring[1], 
        createdUsers.heartsTherapist, 
        orgLocations.expiring[0],
        addDays(new Date(), 1),
        1.5  // 1.5 hours duration
      )
    ]);
    
    // Inactive organization (Coastal)
    await Promise.all([
      // Today's appointment (but would be inaccessible due to inactive subscription)
      createSpecificAppointment(
        orgPatients.inactive[0], 
        createdUsers.coastalTherapist, 
        orgLocations.inactive[0],
        new Date(),
        1  // 1 hour duration
      )
    ]);
    
    // Ensure BCBAs can see appointments for therapists they supervise
    // Active organization (Sunshine)
    const sunshineBcbaPatients = orgPatients.active.slice(0, 5);
    await createdUsers.sunshineBCBA.addPatients(sunshineBcbaPatients);
    
    // Expiring organization (Hearts)
    const heartsBcbaPatients = orgPatients.expiring.slice(0, 3);
    await createdUsers.heartsBCBA.addPatients(heartsBcbaPatients);
    
    // Inactive organization (Coastal)
    const coastalBcbaPatients = orgPatients.inactive.slice(0, 2);
    await createdUsers.coastalBCBA.addPatients(coastalBcbaPatients);
    
    // Add notes for test therapists
    // Active organization (Sunshine)
    await Promise.all(
      sunshineBcbaPatients.map(patient => 
        createSpecificNote(
          patient,
          createdUsers.sunshineTherapist,
          'session',
          faker.lorem.paragraph(5),
          subDays(new Date(), Math.floor(Math.random() * 10))
        )
      )
    );
    
    // Expiring organization (Hearts)
    await Promise.all(
      heartsBcbaPatients.map(patient => 
        createSpecificNote(
          patient,
          createdUsers.heartsTherapist,
          'session',
          faker.lorem.paragraph(5),
          subDays(new Date(), Math.floor(Math.random() * 10))
        )
      )
    );
    
    // Inactive organization (Coastal)
    await Promise.all(
      coastalBcbaPatients.map(patient => 
        createSpecificNote(
          patient,
          createdUsers.coastalTherapist,
          'session',
          faker.lorem.paragraph(5),
          subDays(new Date(), Math.floor(Math.random() * 30)) // Older notes
        )
      )
    );
    
    console.log('Database seeding completed successfully');
    console.log('\nTest account credentials:');
    console.log('-------------------------');
    
    console.log('Sunshine Therapy (Active Subscription):');
    console.log(`Admin:     ${TEST_USERS.sunshineAdmin.email} / ${TEST_USERS.sunshineAdmin.password}`);
    console.log(`BCBA:      ${TEST_USERS.sunshineBCBA.email} / ${TEST_USERS.sunshineBCBA.password}`);
    console.log(`Therapist: ${TEST_USERS.sunshineTherapist.email} / ${TEST_USERS.sunshineTherapist.password}`);
    
    console.log('\nHealing Hearts (Expiring Subscription):');
    console.log(`Admin:     ${TEST_USERS.heartsAdmin.email} / ${TEST_USERS.heartsAdmin.password}`);
    console.log(`BCBA:      ${TEST_USERS.heartsBCBA.email} / ${TEST_USERS.heartsBCBA.password}`);
    console.log(`Therapist: ${TEST_USERS.heartsTherapist.email} / ${TEST_USERS.heartsTherapist.password}`);
    
    console.log('\nCoastal Behavior (Inactive Subscription):');
    console.log(`Admin:     ${TEST_USERS.coastalAdmin.email} / ${TEST_USERS.coastalAdmin.password}`);
    console.log(`BCBA:      ${TEST_USERS.coastalBCBA.email} / ${TEST_USERS.coastalBCBA.password}`);
    console.log(`Therapist: ${TEST_USERS.coastalTherapist.email} / ${TEST_USERS.coastalTherapist.password}`);
    
    return {
      success: true,
      organizations: createdOrgs,
      testCredentials: {
        sunshineAdmin: TEST_USERS.sunshineAdmin,
        sunshineBCBA: TEST_USERS.sunshineBCBA,
        sunshineTherapist: TEST_USERS.sunshineTherapist,
        heartsAdmin: TEST_USERS.heartsAdmin,
        heartsBCBA: TEST_USERS.heartsBCBA,
        heartsTherapist: TEST_USERS.heartsTherapist,
        coastalAdmin: TEST_USERS.coastalAdmin,
        coastalBCBA: TEST_USERS.coastalBCBA,
        coastalTherapist: TEST_USERS.coastalTherapist
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

// Helper function to create a user with organization and role
async function createUserWithOrg(userData, orgId, role) {
  const user = await db.User.create({
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email, // Ensure no mailto: prefix
    password: userData.password, // Pass the plain text password
    phone: faker.phone.number(),
    organizationId: orgId,
    active: true
  });

  // Assign role
  await user.addRole(role);

  return user;
}

// Helper function to create a random user
async function createUser(userData = null, orgId = null) {
  if (userData) {
    // If user data is provided, use it (for test users)
    return await db.User.create({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email, // Ensure no mailto: prefix
      password: userData.password, // Pass the plain text password
      phone: faker.phone.number(),
      organizationId: orgId,
      active: true
    });
  }

  // Otherwise create a random user
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  // Ensure no mailto: prefix by creating email directly
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`.replace(/[^a-zA-Z0-9.@]/g, '');
  const password = faker.internet.password({ length: 10 });

  return await db.User.create({
    firstName,
    lastName,
    email,
    password: password, // Pass the plain text password
    phone: faker.phone.number(),
    organizationId: orgId,
    active: true
  });
}

// Helper function to create a random location
async function createLocation(orgId = null) {
  return await db.Location.create({
    name: faker.company.name() + ' Clinic',
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode(),
    phone: faker.phone.number(),
    organizationId: orgId,
    active: true
  });
}

// Helper function to create a random patient
async function createPatient(orgId = null) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const dateOfBirth = faker.date.birthdate({ min: 2, max: 18, mode: 'age' });
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
    status: faker.helpers.arrayElement(['active', 'active', 'active', 'inactive']),
    organizationId: orgId
  });
}

// Helper function to create a random appointment
async function createAppointment(patient, therapists, locations) {
  const therapist = faker.helpers.arrayElement(therapists);
  const location = faker.helpers.arrayElement(locations);
  const startDate = faker.date.soon({ days: 14 });
  const durationHours = faker.helpers.arrayElement([1, 1.5, 2]);
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
  
  // Get BCBA from patient assignees or primary BCBA
  let bcba;
  if (patient.primaryBcbaId) {
    bcba = await db.User.findByPk(patient.primaryBcbaId);
  } else {
    const patientAssignees = await patient.getAssignees({
      include: [{
        model: db.Role,
        where: { name: 'bcba' },
        through: { attributes: [] }
      }]
    });
    
    if (patientAssignees && patientAssignees.length > 0) {
      bcba = faker.helpers.arrayElement(patientAssignees);
    } else {
      // If no BCBA assigned, find a random BCBA from the same organization
      const bcbaRole = await db.Role.findOne({ where: { name: 'bcba' } });
      const organizationBcbas = await db.User.findAll({
        include: [{
          model: db.Role,
          where: { id: bcbaRole.id },
          through: { attributes: [] }
        }],
        where: { organizationId: patient.organizationId }
      });
      
      if (organizationBcbas.length > 0) {
        bcba = faker.helpers.arrayElement(organizationBcbas);
      }
    }
  }
  
  if (!bcba) {
    throw new Error('No BCBA found for patient appointment');
  }
  
  return await db.Appointment.create({
    startTime: startDate,
    endTime: endDate,
    title: faker.helpers.arrayElement(['Therapy Session', 'Assessment', 'Parent Meeting', 'Skills Training']),
    status: faker.helpers.arrayElement(['scheduled', 'scheduled', 'scheduled', 'completed', 'cancelled']),
    notes: Math.random() > 0.5 ? faker.lorem.sentence() : null,
    recurring: Math.random() > 0.8,
    recurringPattern: Math.random() > 0.8 ? { frequency: 'weekly', day: startDate.getDay() } : null,
    excludeWeekends: Math.random() > 0.2, // 80% chance to exclude weekends
    excludeHolidays: Math.random() > 0.2, // 80% chance to exclude holidays
    therapistId: therapist.id,
    bcbaId: bcba.id,
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
  
  // Get a BCBA (either the primary BCBA or a random assigned BCBA)
  let bcba;
  if (patient.primaryBcbaId) {
    bcba = await db.User.findByPk(patient.primaryBcbaId);
  } else {
    const bcbaRole = await db.Role.findOne({ where: { name: 'bcba' } });
    const bcbas = await db.User.findAll({
      include: [
        {
          model: db.Role,
          where: { id: bcbaRole.id },
          through: { attributes: [] }
        }
      ],
      where: { organizationId: patient.organizationId }
    });
    
    if (bcbas.length > 0) {
      bcba = bcbas[0];  // Use the first BCBA for consistency
    } else {
      throw new Error('No BCBA found for test appointment');
    }
  }
  
  return await db.Appointment.create({
    startTime: startDate,
    endTime: endDate,
    title: faker.helpers.arrayElement(['Therapy Session', 'Assessment', 'Parent Meeting', 'Skills Training']),
    status: 'scheduled',
    notes: faker.lorem.sentence(),
    recurring: false,
    excludeWeekends: true,
    excludeHolidays: true,
    therapistId: therapist.id,
    bcbaId: bcba.id,
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