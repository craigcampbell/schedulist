import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { addDays, subDays, addHours, addMonths, subMonths, startOfWeek, setHours, setMinutes, isSameDay } from 'date-fns';
import db from '../src/models/index.js';

// Number of users and entities to create
const NUM_ADMINS = 2;
const NUM_BCBAS = 5;
const NUM_THERAPISTS = 15;
const NUM_PATIENTS = 25;
const NUM_LOCATIONS = 4;
const NOTES_PER_PATIENT = 8;

// Patient color palette for visual identification
const PATIENT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85D8E0', '#D7BDE2',
  '#A9DFBF', '#F9E79F', '#D5A6BD', '#AED6F1', '#F4D03F',
  '#C39BD3', '#7FB3D3', '#76D7C4', '#F7DC6F', '#D2B4DE'
];

// Comprehensive insurance providers
const INSURANCE_PROVIDERS = [
  'Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 
  'Humana', 'Kaiser Permanente', 'Anthem', 'Molina Healthcare',
  'Centene', 'Independence Blue Cross', 'Medicare', 'Medicaid',
  'Tricare', 'BCBS Federal', 'Oscar Health'
];

// Appointment types with updated distribution and rules
const APPOINTMENT_TYPE_DISTRIBUTION = {
  direct: { weight: 0.75, avgHours: 2.0, requiresPatient: true },      // 75% direct therapy
  indirect: { weight: 0.10, avgHours: 1.0, requiresPatient: false },   // 10% documentation/prep - NO PATIENT
  supervision: { weight: 0.05, avgHours: 1.5, requiresPatient: false }, // 5% supervision - NO PATIENT
  lunch: { weight: 0.05, avgHours: 0.5, requiresPatient: false },      // 5% lunch breaks - NO PATIENT
  circle: { weight: 0.03, avgHours: 1.0, requiresPatient: true },      // 3% group activities
  cleaning: { weight: 0.01, avgHours: 0.5, requiresPatient: false },    // 1% cleaning time - NO PATIENT
  parentTraining: { weight: 0.01, avgHours: 1.5, requiresPatient: false } // 1% parent training - NO PATIENT
};

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
    createdUsers.sunshineAdmin = await createUserWithOrg(TEST_USERS.sunshineAdmin, createdOrgs.active.id, adminRole);
    createdUsers.sunshineBCBA = await createUserWithOrg(TEST_USERS.sunshineBCBA, createdOrgs.active.id, bcbaRole);
    createdUsers.sunshineTherapist = await createUserWithOrg(TEST_USERS.sunshineTherapist, createdOrgs.active.id, therapistRole);
    
    // Organization 2 - Expiring subscription (Healing Hearts)
    createdUsers.heartsAdmin = await createUserWithOrg(TEST_USERS.heartsAdmin, createdOrgs.expiring.id, adminRole);
    createdUsers.heartsBCBA = await createUserWithOrg(TEST_USERS.heartsBCBA, createdOrgs.expiring.id, bcbaRole);
    createdUsers.heartsTherapist = await createUserWithOrg(TEST_USERS.heartsTherapist, createdOrgs.expiring.id, therapistRole);
    
    // Organization 3 - Inactive subscription (Coastal Behavior)
    createdUsers.coastalAdmin = await createUserWithOrg(TEST_USERS.coastalAdmin, createdOrgs.inactive.id, adminRole);
    createdUsers.coastalBCBA = await createUserWithOrg(TEST_USERS.coastalBCBA, createdOrgs.inactive.id, bcbaRole);
    createdUsers.coastalTherapist = await createUserWithOrg(TEST_USERS.coastalTherapist, createdOrgs.inactive.id, therapistRole);
    
    console.log('Test users created for all organizations');
    
    // Create additional users for each organization
    const orgAdditionalUsers = {
      active: { admins: [], bcbas: [], therapists: [] },
      expiring: { admins: [], bcbas: [], therapists: [] },
      inactive: { admins: [], bcbas: [], therapists: [] }
    };
    
    // Active organization (Sunshine)
    for (let i = 1; i < NUM_ADMINS; i++) {
      const admin = await createUserWithOrg(null, createdOrgs.active.id, adminRole);
      orgAdditionalUsers.active.admins.push(admin);
    }
    
    for (let i = 1; i < NUM_BCBAS - 1; i++) {
      const bcba = await createUserWithOrg(null, createdOrgs.active.id, bcbaRole);
      orgAdditionalUsers.active.bcbas.push(bcba);
    }
    
    for (let i = 1; i < NUM_THERAPISTS - 2; i++) {
      const therapist = await createUserWithOrg(null, createdOrgs.active.id, therapistRole);
      orgAdditionalUsers.active.therapists.push(therapist);
    }
    
    // Expiring organization (Hearts) - fewer users
    for (let i = 0; i < 1; i++) {
      const bcba = await createUserWithOrg(null, createdOrgs.expiring.id, bcbaRole);
      orgAdditionalUsers.expiring.bcbas.push(bcba);
    }
    
    for (let i = 0; i < 3; i++) {
      const therapist = await createUserWithOrg(null, createdOrgs.expiring.id, therapistRole);
      orgAdditionalUsers.expiring.therapists.push(therapist);
    }
    
    // Inactive organization (Coastal) - minimal users
    for (let i = 0; i < 1; i++) {
      const therapist = await createUserWithOrg(null, createdOrgs.inactive.id, therapistRole);
      orgAdditionalUsers.inactive.therapists.push(therapist);
    }
    
    console.log('Additional users created for all organizations');
    
    // Create locations for each organization
    const orgLocations = {
      active: [],
      expiring: [],
      inactive: []
    };
    
    // Active organization locations
    for (let i = 0; i < NUM_LOCATIONS - 1; i++) {
      const location = await createLocation(createdOrgs.active.id);
      orgLocations.active.push(location);
    }
    
    // Expiring organization locations (just 1)
    const expiringLocation = await createLocation(createdOrgs.expiring.id);
    orgLocations.expiring.push(expiringLocation);
    
    // Inactive organization locations (just 1)
    const inactiveLocation = await createLocation(createdOrgs.inactive.id);
    orgLocations.inactive.push(inactiveLocation);
    
    console.log('Locations created for all organizations');
    
    // Create patients for each organization
    const orgPatients = {
      active: [],
      expiring: [],
      inactive: []
    };
    
    // Active organization patients (most patients)
    for (let i = 0; i < NUM_PATIENTS - 5; i++) {
      const patient = await createPatient(createdOrgs.active.id, i);
      orgPatients.active.push(patient);
    }
    
    // Expiring organization patients
    for (let i = 0; i < 4; i++) {
      const patient = await createPatient(createdOrgs.expiring.id, NUM_PATIENTS - 5 + i);
      orgPatients.expiring.push(patient);
    }
    
    // Inactive organization patients (just 1)
    const inactivePatient = await createPatient(createdOrgs.inactive.id, NUM_PATIENTS - 1);
    orgPatients.inactive.push(inactivePatient);
    
    console.log('Patients created for all organizations');
    
    // Assign patients to BCBAs and therapists
    // Active organization (Sunshine)
    const activeBCBAs = [createdUsers.sunshineBCBA, ...orgAdditionalUsers.active.bcbas];
    const activeTherapists = [createdUsers.sunshineTherapist, ...orgAdditionalUsers.active.therapists];
    
    for (const patient of orgPatients.active) {
      // Assign to 1 or 2 BCBAs
      const numBcbas = Math.random() > 0.7 ? 2 : 1;
      const selectedBcbas = getRandomElements(activeBCBAs, numBcbas);
      await patient.addAssignees(selectedBcbas);
      
      // Set the first BCBA as primary
      if (selectedBcbas.length > 0) {
        await patient.setPrimaryBCBA(selectedBcbas[0]);
      }
      
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
      
      // Set the first BCBA as primary
      if (selectedBcbas.length > 0) {
        await patient.setPrimaryBCBA(selectedBcbas[0]);
      }
      
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
      
      // Set the first BCBA as primary
      if (selectedBcbas.length > 0) {
        await patient.setPrimaryBCBA(selectedBcbas[0]);
      }
      
      // Assign to 1-3 therapists
      const numTherapists = Math.floor(Math.random() * 3) + 1;
      const selectedTherapists = getRandomElements(inactiveTherapists, numTherapists);
      await patient.addAssignees(selectedTherapists);
    }
    
    console.log('Assigned patients to BCBAs and therapists for all organizations');
    
    // Create comprehensive appointment schedules for each organization
    // Active organization (Sunshine)
    let allAppointments = [];
    const therapistSchedules = new Map(); // Track daily schedules for lunch rules
    
    // Create a week's worth of appointments for each therapist
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Start on Monday
    
    for (const therapist of activeTherapists) {
      // Get patients assigned to this therapist
      const therapistPatients = [];
      for (const patient of orgPatients.active) {
        const assignees = await patient.getAssignees();
        if (assignees.some(a => a.id === therapist.id)) {
          therapistPatients.push(patient);
        }
      }
      
      if (therapistPatients.length === 0) continue;
      
      // Create appointments for 5 weekdays
      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const currentDay = addDays(weekStart, dayOffset);
        const dailyAppointments = await createDailyScheduleForTherapist(
          therapist,
          therapistPatients,
          orgLocations.active,
          currentDay,
          therapistSchedules
        );
        allAppointments.push(...dailyAppointments);
      }
    }
    
    // Expiring organization (Hearts) - similar but less data
    for (const therapist of expiringTherapists) {
      const therapistPatients = [];
      for (const patient of orgPatients.expiring) {
        const assignees = await patient.getAssignees();
        if (assignees.some(a => a.id === therapist.id)) {
          therapistPatients.push(patient);
        }
      }
      
      if (therapistPatients.length === 0) continue;
      
      // Create appointments for current week
      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const currentDay = addDays(weekStart, dayOffset);
        const dailyAppointments = await createDailyScheduleForTherapist(
          therapist,
          therapistPatients,
          orgLocations.expiring,
          currentDay,
          therapistSchedules
        );
        allAppointments.push(...dailyAppointments);
      }
    }
    
    console.log(`Created ${allAppointments.length} appointments across all organizations`);
    
    // Create notes for each organization
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
    
    console.log(`Created ${allNotes.length} clinical notes across all organizations`);
    
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
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(userData ? userData.password : 'Password123', salt);
  
  const user = await db.User.create({
    firstName: userData ? userData.firstName : faker.person.firstName(),
    lastName: userData ? userData.lastName : faker.person.lastName(),
    email: userData ? userData.email : faker.internet.email().toLowerCase(),
    password: hashedPassword,
    phone: faker.phone.number(),
    organizationId: orgId,
    active: true
  });
  
  // Assign role
  await user.addRole(role);
  
  return user;
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

// Helper function to create a random patient with comprehensive data
async function createPatient(orgId = null, colorIndex = 0) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  
  // Generate realistic birthdate for children/teens (2-18 years old)
  const dateOfBirth = faker.date.birthdate({ min: 2, max: 18, mode: 'age' });
  
  // Select insurance provider and generate comprehensive insurance info
  const insuranceProvider = faker.helpers.arrayElement(INSURANCE_PROVIDERS);
  const insuranceId = generateInsuranceId(insuranceProvider);
  
  // Generate realistic phone number
  const phone = faker.phone.number('(###) ###-####');
  
  // Generate full address
  const address = `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}`;
  
  // Assign 25-35 required weekly hours
  const requiredWeeklyHours = faker.number.int({ min: 25, max: 35 });
  
  // Assign color from palette (cycling through colors)
  const color = PATIENT_COLORS[colorIndex % PATIENT_COLORS.length];
  
  return await db.Patient.create({
    firstName,
    lastName,
    dateOfBirth: dateOfBirth.toISOString(),
    insuranceProvider,
    insuranceId,
    phone,
    address,
    requiredWeeklyHours,
    color,
    status: faker.helpers.arrayElement(['active', 'active', 'active', 'active', 'inactive']), // 80% active
    organizationId: orgId
  });
}

// Helper function to generate realistic insurance IDs
function generateInsuranceId(provider) {
  switch (provider.toLowerCase()) {
    case 'medicare':
      return `${faker.number.int({ min: 100000000, max: 999999999 })}-${faker.string.alpha({ length: 2 }).toUpperCase()}`;
    case 'medicaid':
      return faker.number.int({ min: 10000000000, max: 99999999999 }).toString();
    case 'tricare':
      return `${faker.number.int({ min: 1000000000, max: 9999999999 })}`;
    default:
      return `${faker.string.alphanumeric({ length: 3 }).toUpperCase()}${faker.number.int({ min: 100000000, max: 999999999 })}`;
  }
}

// Helper function to create a daily schedule for a therapist
async function createDailyScheduleForTherapist(therapist, patients, locations, date, therapistSchedules) {
  const appointments = [];
  const dayKey = `${therapist.id}-${date.toISOString().split('T')[0]}`;
  
  // Track hours for this day
  let dailyDirectHours = 0;
  let totalDailyHours = 0;
  const dailyAppointments = [];
  
  // Start time at 8 AM
  let currentTime = setMinutes(setHours(date, 8), 0);
  const endOfDay = setHours(date, 17); // 5 PM end
  
  // Shuffle patients for variety
  const shuffledPatients = [...patients].sort(() => 0.5 - Math.random());
  let patientIndex = 0;
  
  while (currentTime < endOfDay && totalDailyHours < 8) {
    // Determine next appointment type
    let appointmentType = 'direct';
    let duration = 2; // Default 2 hours for direct
    let needsPatient = true;
    
    // Check if we need a lunch break (after 6 hours of direct service, no lunch yet today)
    const hasLunchToday = dailyAppointments.some(app => app.serviceType === 'lunch');
    if (dailyDirectHours >= 6 && !hasLunchToday) {
      appointmentType = 'lunch';
      duration = 0.5;
      needsPatient = false;
    } else {
      // Random selection based on weights
      const rand = Math.random();
      if (rand < 0.85) {
        // 85% direct service
        appointmentType = 'direct';
        duration = faker.helpers.arrayElement([1.5, 2, 2.5]);
        needsPatient = true;
      } else if (rand < 0.90) {
        // 5% indirect work
        appointmentType = 'indirect';
        duration = 1;
        needsPatient = false;
      } else if (rand < 0.93) {
        // 3% circle time
        appointmentType = 'circle';
        duration = 1;
        needsPatient = true;
      } else if (rand < 0.96) {
        // 3% supervision
        appointmentType = 'supervision';
        duration = 1;
        needsPatient = false;
      } else if (rand < 0.98) {
        // 2% cleaning
        appointmentType = 'cleaning';
        duration = 0.5;
        needsPatient = false;
      } else {
        // 2% parent training (BCBA only - skip for regular therapists)
        appointmentType = 'indirect'; // Default to indirect for therapists
        duration = 1;
        needsPatient = false;
      }
    }
    
    // Check if we have enough time left in the day
    const endTime = addHours(currentTime, duration);
    if (endTime > endOfDay) break;
    
    // Create appointment
    const location = faker.helpers.arrayElement(locations);
    const patient = needsPatient ? shuffledPatients[patientIndex % shuffledPatients.length] : null;
    
    const appointment = await createAppointmentWithDetails(
      patient,
      therapist,
      location,
      currentTime,
      duration,
      appointmentType
    );
    
    appointments.push(appointment);
    dailyAppointments.push(appointment);
    
    // Update counters
    if (appointmentType === 'direct') {
      dailyDirectHours += duration;
    }
    totalDailyHours += duration;
    
    // Move to next time slot
    currentTime = endTime;
    
    // Add a 15-minute break between appointments sometimes
    if (Math.random() > 0.7 && totalDailyHours < 7) {
      currentTime = addHours(currentTime, 0.25);
    }
    
    // Move to next patient for variety
    if (needsPatient) {
      patientIndex++;
    }
  }
  
  // Store the schedule for tracking
  therapistSchedules.set(dayKey, {
    directHours: dailyDirectHours,
    totalHours: totalDailyHours,
    appointments: dailyAppointments
  });
  
  return appointments;
}

// Helper function to create appointment with specific details
async function createAppointmentWithDetails(patient, therapist, location, startTime, durationHours, serviceType) {
  const endTime = addHours(startTime, durationHours);
  
  // Generate appropriate title based on service type
  const titles = {
    direct: ['Direct Therapy', 'ABA Session', 'Skills Training', 'Behavior Intervention'],
    indirect: ['Documentation', 'Prep Work', 'Program Planning', 'Data Review'],
    supervision: ['Supervision Meeting', 'Case Review', 'Training Session'],
    lunch: ['Lunch Break'],
    circle: ['Circle Time', 'Group Activity', 'Social Skills Group'],
    cleaning: ['Room Cleaning', 'Equipment Sanitization'],
    parentTraining: ['Parent Training', 'Family Meeting', 'Parent Consultation']
  };
  
  const title = faker.helpers.arrayElement(titles[serviceType] || titles.direct);
  
  // Create appointment data
  const appointmentData = {
    startTime,
    endTime,
    title,
    serviceType,
    status: 'scheduled',
    notes: Math.random() > 0.6 ? faker.lorem.sentence() : null,
    recurring: false,
    therapistId: therapist.id,
    locationId: location.id
  };
  
  // Only add patientId if the service type requires a patient
  if (patient && APPOINTMENT_TYPE_DISTRIBUTION[serviceType]?.requiresPatient) {
    appointmentData.patientId = patient.id;
  }
  
  return await db.Appointment.create(appointmentData);
}

// Helper function to create a random note
async function createNote(patient, users) {
  const author = faker.helpers.arrayElement(users);
  const noteType = faker.helpers.arrayElement(['session', 'progress', 'assessment', 'general', 'behavior', 'goals']);
  const sessionDate = faker.date.recent({ days: 45 });
  
  // Generate more realistic note content based on type
  let content;
  switch (noteType) {
    case 'session':
      content = `Session Summary: ${faker.lorem.paragraph(3)} Target behaviors: ${faker.lorem.sentence()} Progress observed: ${faker.lorem.sentence()}`;
      break;
    case 'progress':
      content = `Progress Update: ${faker.lorem.paragraph(2)} Goals achieved: ${faker.lorem.sentence()} Next steps: ${faker.lorem.sentence()}`;
      break;
    case 'assessment':
      content = `Assessment Results: ${faker.lorem.paragraph(3)} Recommendations: ${faker.lorem.sentence()}`;
      break;
    case 'behavior':
      content = `Behavior Analysis: ${faker.lorem.paragraph(2)} Interventions applied: ${faker.lorem.sentence()} Response to intervention: ${faker.lorem.sentence()}`;
      break;
    case 'goals':
      content = `Goal Review: ${faker.lorem.paragraph(2)} Target skills: ${faker.lorem.sentence()} Mastery criteria: ${faker.lorem.sentence()}`;
      break;
    default:
      content = faker.lorem.paragraphs(2);
  }
  
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

// Run if this file is executed directly
if (process.argv[1] === import.meta.url) {
  seedDatabase();
}

export default seedDatabase;