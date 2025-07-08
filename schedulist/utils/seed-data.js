const { faker } = require('@faker-js/faker');
const { addDays, subDays, addMonths, subMonths, startOfWeek, setHours, setMinutes } = require('date-fns');
const db = require('../src/models');

// Number of users and entities to create
const NUM_ADMINS = 2;
const NUM_BCBAS = 5;
const NUM_THERAPISTS = 15;
const NUM_PATIENTS = 25;
const NUM_LOCATIONS = 4;
const APPOINTMENTS_PER_PATIENT = 30; // Increased for more appointments
const NOTES_PER_PATIENT = 8;
const WEEKS_TO_SCHEDULE = 8; // Schedule appointments for 8 weeks

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

// Appointment types with required hours distribution AND patient requirements
const APPOINTMENT_TYPE_DISTRIBUTION = {
  direct: { weight: 0.70, avgHours: 2.0, requiresPatient: true },       // 70% direct therapy - NEEDS PATIENT
  indirect: { weight: 0.10, avgHours: 1.0, requiresPatient: false },    // 10% documentation/prep - NO PATIENT
  supervision: { weight: 0.08, avgHours: 1.5, requiresPatient: false }, // 8% supervision - NO PATIENT
  lunch: { weight: 0.05, avgHours: 0.5, requiresPatient: false },       // 5% lunch breaks - NO PATIENT
  circle: { weight: 0.04, avgHours: 1.0, requiresPatient: true },       // 4% group activities - NEEDS PATIENT
  cleaning: { weight: 0.03, avgHours: 0.5, requiresPatient: false }     // 3% cleaning time - NO PATIENT
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
  sunshineBCBA2: {
    firstName: 'Barbara',
    lastName: 'BCBA',
    email: 'bcba2@sunshine.com',
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
    createdUsers.sunshineBCBA2 = await createUserWithOrg(TEST_USERS.sunshineBCBA2, createdOrgs.active.id, bcbaRole);
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
    
    for (let i = 2; i < NUM_BCBAS; i++) {
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
    
    // Assign patients to BCBAs and therapists with varied workloads
    // Active organization (Sunshine)
    const activeBCBAs = [createdUsers.sunshineBCBA, createdUsers.sunshineBCBA2, ...orgAdditionalUsers.active.bcbas];
    const activeTherapists = [createdUsers.sunshineTherapist, ...orgAdditionalUsers.active.therapists];
    
    // Track patient counts for load balancing
    const therapistPatientCounts = new Map();
    const bcbaPatientCounts = new Map();
    activeTherapists.forEach(t => therapistPatientCounts.set(t.id, 0));
    activeBCBAs.forEach(b => bcbaPatientCounts.set(b.id, 0));
    
    // Define therapist load categories
    const therapistCategories = activeTherapists.map((t, idx) => {
      if (idx < Math.floor(activeTherapists.length * 0.3)) {
        return { therapist: t, maxPatients: 8, category: 'full' }; // 30% have full load
      } else if (idx < Math.floor(activeTherapists.length * 0.6)) {
        return { therapist: t, maxPatients: 5, category: 'medium' }; // 30% have medium load
      } else {
        return { therapist: t, maxPatients: 2, category: 'light' }; // 40% have light load
      }
    });
    
    for (const patient of orgPatients.active) {
      // Assign BCBA - balance the load
      const sortedBCBAs = activeBCBAs.sort((a, b) => 
        (bcbaPatientCounts.get(a.id) || 0) - (bcbaPatientCounts.get(b.id) || 0)
      );
      const selectedBcba = sortedBCBAs[0];
      await patient.addAssignees([selectedBcba]);
      await patient.setPrimaryBCBA(selectedBcba);
      bcbaPatientCounts.set(selectedBcba.id, (bcbaPatientCounts.get(selectedBcba.id) || 0) + 1);
      
      // Assign therapists based on patient needs and therapist availability
      const numTherapists = patient.requiredWeeklyHours > 25 ? 2 : 1;
      const availableTherapists = therapistCategories
        .filter(({ therapist, maxPatients }) => 
          (therapistPatientCounts.get(therapist.id) || 0) < maxPatients
        )
        .map(({ therapist }) => therapist);
      
      if (availableTherapists.length >= numTherapists) {
        const selectedTherapists = getRandomElements(availableTherapists, numTherapists);
        await patient.addAssignees(selectedTherapists);
        selectedTherapists.forEach(t => {
          therapistPatientCounts.set(t.id, (therapistPatientCounts.get(t.id) || 0) + 1);
        });
      } else {
        // Fallback: use any therapist
        const selectedTherapists = getRandomElements(activeTherapists, numTherapists);
        await patient.addAssignees(selectedTherapists);
      }
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
    
    // Create teams for each organization
    console.log('Creating teams...');
    
    // Team colors for visual distinction
    const TEAM_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
    
    // Active organization teams (Sunshine)
    for (let i = 0; i < activeBCBAs.length; i++) {
      const bcba = activeBCBAs[i];
      const teamColor = TEAM_COLORS[i % TEAM_COLORS.length];
      
      // Create team with BCBA's name
      const team = await db.Team.create({
        name: `Team ${bcba.firstName}`,
        leadBcbaId: bcba.id,
        color: teamColor
      });
      
      // Get therapists that work with this BCBA's patients
      const bcbaPatients = [];
      for (const patient of orgPatients.active) {
        const assignees = await patient.getAssignees();
        if (assignees.some(a => a.id === bcba.id)) {
          bcbaPatients.push(patient);
        }
      }
      
      // Find therapists assigned to these patients
      const teamTherapists = new Set();
      for (const patient of bcbaPatients) {
        const assignees = await patient.getAssignees();
        const therapists = assignees.filter(a => 
          activeTherapists.some(t => t.id === a.id)
        );
        therapists.forEach(t => teamTherapists.add(t));
      }
      
      // Add therapists to team
      for (const therapist of teamTherapists) {
        await team.addMember(therapist);
      }
      
      // Assign team to patients
      for (const patient of bcbaPatients) {
        patient.teamId = team.id;
        await patient.save();
      }
      
      console.log(`Created ${team.name} with ${teamTherapists.size} therapists and ${bcbaPatients.length} patients`);
    }
    
    // Expiring organization teams (Hearts)
    for (let i = 0; i < expiringBCBAs.length; i++) {
      const bcba = expiringBCBAs[i];
      const teamColor = TEAM_COLORS[(activeBCBAs.length + i) % TEAM_COLORS.length];
      
      const team = await db.Team.create({
        name: `Team ${bcba.firstName}`,
        leadBcbaId: bcba.id,
        color: teamColor
      });
      
      // Get therapists for this BCBA
      const bcbaPatients = [];
      for (const patient of orgPatients.expiring) {
        const assignees = await patient.getAssignees();
        if (assignees.some(a => a.id === bcba.id)) {
          bcbaPatients.push(patient);
        }
      }
      
      const teamTherapists = new Set();
      for (const patient of bcbaPatients) {
        const assignees = await patient.getAssignees();
        const therapists = assignees.filter(a => 
          expiringTherapists.some(t => t.id === a.id)
        );
        therapists.forEach(t => teamTherapists.add(t));
      }
      
      for (const therapist of teamTherapists) {
        await team.addMember(therapist);
      }
      
      // Assign team to patients
      for (const patient of bcbaPatients) {
        patient.teamId = team.id;
        await patient.save();
      }
      
      console.log(`Created ${team.name} with ${teamTherapists.size} therapists and ${bcbaPatients.length} patients`);
    }
    
    console.log('Teams created successfully');
    
    // Create comprehensive appointment schedules
    let allAppointments = [];
    const therapistSchedules = new Map(); // Track daily schedules for lunch rules
    
    // Create appointments for multiple weeks
    const today = new Date();
    const startDate = subDays(today, 14); // Start 2 weeks ago
    
    console.log(`Creating appointments for ${WEEKS_TO_SCHEDULE} weeks starting from ${startDate.toDateString()}`);
    
    // Active organization (Sunshine)
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
      
      // Create appointments for multiple weeks
      for (let week = 0; week < WEEKS_TO_SCHEDULE; week++) {
        const weekStart = startOfWeek(addDays(startDate, week * 7), { weekStartsOn: 1 });
        
        // Create appointments for 5 weekdays
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
          const currentDay = addDays(weekStart, dayOffset);
          
          // Skip weekends
          const dayOfWeek = currentDay.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;
          
          // Sometimes skip a day (therapist not working)
          if (Math.random() < 0.1) continue;
          
          const dailyAppointments = await createDailyScheduleForTherapist(
            therapist,
            therapistPatients,
            orgLocations.active,
            activeBCBAs,
            currentDay,
            therapistSchedules
          );
          allAppointments.push(...dailyAppointments);
        }
      }
    }
    
    // Expiring organization (Hearts) - create appointments for 2 weeks only
    for (const therapist of expiringTherapists) {
      const therapistPatients = [];
      for (const patient of orgPatients.expiring) {
        const assignees = await patient.getAssignees();
        if (assignees.some(a => a.id === therapist.id)) {
          therapistPatients.push(patient);
        }
      }
      
      if (therapistPatients.length === 0) continue;
      
      // Create appointments for 2 weeks
      for (let week = 0; week < 2; week++) {
        const weekStart = startOfWeek(addDays(today, week * 7), { weekStartsOn: 1 });
        
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
          const currentDay = addDays(weekStart, dayOffset);
          
          // Skip weekends
          const dayOfWeek = currentDay.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;
          
          const dailyAppointments = await createDailyScheduleForTherapist(
            therapist,
            therapistPatients,
            orgLocations.expiring,
            expiringBCBAs,
            currentDay,
            therapistSchedules
          );
          allAppointments.push(...dailyAppointments);
        }
      }
    }
    
    // Parent training appointments removed as parentTraining is not a valid serviceType in the database
    // To add parent training in the future, the appointment model enum needs to be updated
    
    console.log(`Created ${allAppointments.length} appointments across all organizations`);
    
    // Create notes for each organization
    let allNotes = [];
    for (const patient of orgPatients.active) {
      try {
        const patientAssignees = await patient.getAssignees({
          include: [{
            model: db.Role,
            through: { attributes: [] }
          }]
        });
        const notesCreators = patientAssignees;
        
        if (notesCreators.length === 0) continue;
        
        const notes = await Promise.all(
          Array(NOTES_PER_PATIENT).fill().map(() => 
            createNote(patient, notesCreators)
          )
        );
        allNotes.push(...notes);
      } catch (error) {
        console.error(`Error creating notes for patient ${patient.firstName}:`, error);
      }
    }
    
    // Expiring organization (Hearts)
    for (const patient of orgPatients.expiring) {
      try {
        const patientAssignees = await patient.getAssignees({
          include: [{
            model: db.Role,
            through: { attributes: [] }
          }]
        });
        const notesCreators = patientAssignees;
        
        if (notesCreators.length === 0) continue;
        
        const notes = await Promise.all(
          Array(NOTES_PER_PATIENT).fill().map(() => 
            createNote(patient, notesCreators)
          )
        );
        allNotes.push(...notes);
      } catch (error) {
        console.error(`Error creating notes for patient ${patient.firstName}:`, error);
      }
    }
    
    console.log(`Created ${allNotes.length} clinical notes across all organizations`);
    
    // Create patient schedule templates and time blocks for the new scheduling system
    await createPatientScheduleData(orgPatients);
    
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
    firstName: userData ? userData.firstName : faker.person.firstName(),
    lastName: userData ? userData.lastName : faker.person.lastName(),
    email: userData ? userData.email : faker.internet.email(), // Ensure no mailto: prefix
    password: userData ? userData.password : 'Password123', // Pass the plain text password
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
  const age = faker.number.int({ min: 2, max: 18 });
  const dateOfBirth = new Date();
  dateOfBirth.setFullYear(dateOfBirth.getFullYear() - age);
  dateOfBirth.setMonth(faker.number.int({ min: 0, max: 11 }));
  dateOfBirth.setDate(faker.number.int({ min: 1, max: 28 }));
  
  // Select insurance provider and generate comprehensive insurance info
  const insuranceProvider = faker.helpers.arrayElement(INSURANCE_PROVIDERS);
  const insuranceId = generateInsuranceId(insuranceProvider);
  
  // Generate realistic phone number
  const phone = faker.phone.number('(###) ###-####');
  
  // Generate full address
  const address = `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}`;
  
  // Varied required weekly hours - some light, some full load
  const loadTypes = [
    { min: 10, max: 15 }, // Light load
    { min: 20, max: 25 }, // Medium load
    { min: 30, max: 40 }, // Full load
  ];
  const loadType = faker.helpers.arrayElement(loadTypes);
  const requiredWeeklyHours = faker.number.int(loadType);
  
  // Assign color from palette (cycling through colors)
  const color = PATIENT_COLORS[colorIndex % PATIENT_COLORS.length];
  
  // Generate approved hours data (quarterly approval)
  const approvedHours = requiredWeeklyHours * 13; // Quarterly (13 weeks)
  const approvedStartDate = subMonths(new Date(), 2); // Started 2 months ago
  const approvedEndDate = addMonths(approvedStartDate, 3); // 3 month period
  const usedHours = faker.number.float({ min: 0, max: approvedHours * 0.8 }); // Used up to 80% of approved hours
  
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
    approvedHours,
    approvedHoursStartDate: approvedStartDate,
    approvedHoursEndDate: approvedEndDate,
    usedHours,
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
async function createDailyScheduleForTherapist(therapist, patients, locations, bcbas, date, therapistSchedules) {
  const appointments = [];
  const dayKey = `${therapist.id}-${date.toISOString().split('T')[0]}`;
  
  // Track hours for this day
  let dailyDirectHours = 0;
  let totalDailyHours = 0;
  const dailyAppointments = [];
  
  // Vary start times between 7:30 AM and 9 AM
  const startHour = faker.helpers.arrayElement([7.5, 8, 8.5, 9]);
  let currentTime = setMinutes(setHours(date, Math.floor(startHour)), (startHour % 1) * 60);
  
  // End time varies between 4 PM and 6 PM
  const endHour = faker.helpers.arrayElement([16, 17, 18]);
  const endOfDay = setHours(date, endHour);
  
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
      } else {
        // 2% cleaning
        appointmentType = 'cleaning';
        duration = 0.5;
        needsPatient = false;
      }
    }
    
    // Check if we have enough time left in the day
    const endTime = addDays(currentTime, duration / 24); // Convert hours to days fraction
    if (endTime > endOfDay) break;
    
    // Create appointment
    const location = faker.helpers.arrayElement(locations);
    const patient = needsPatient && shuffledPatients.length > 0 ? shuffledPatients[patientIndex % shuffledPatients.length] : null;
    const bcba = patient ? (await patient.getPrimaryBCBA() || faker.helpers.arrayElement(bcbas)) : faker.helpers.arrayElement(bcbas);
    
    const appointment = await createAppointmentWithDetails(
      patient,
      therapist,
      bcba,
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
    currentTime = new Date(currentTime.getTime() + duration * 60 * 60 * 1000);
    
    // Add a 15-minute break between appointments sometimes
    if (Math.random() > 0.7 && totalDailyHours < 7) {
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
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

// Note: Parent training appointments have been removed since 'parentTraining' 
// is not a valid serviceType in the current database schema.
// To add parent training functionality:
// 1. Update the Appointment model to include 'parentTraining' in the serviceType enum
// 2. Run a migration to update the database
// 3. Uncomment and use this function or create parent training as 'supervision' type

// Helper function to create appointment with specific details
async function createAppointmentWithDetails(patient, therapist, bcba, location, startTime, durationHours, serviceType) {
  const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
  
  // Occasionally mark some appointments as cancelled or completed
  let status = 'scheduled';
  const now = new Date();
  
  if (startTime < now) {
    // Past appointments
    const rand = Math.random();
    if (rand < 0.75) {
      status = 'completed'; // 75% of past appointments are completed
    } else if (rand < 0.90) {
      status = 'cancelled'; // 15% are cancelled
    } else if (rand < 0.95) {
      status = 'no-show'; // 5% are no-shows
    }
    // 5% remain scheduled (missed updating)
  } else {
    // Future appointments
    if (Math.random() < 0.05) {
      status = 'cancelled'; // 5% of future appointments are pre-cancelled
    }
  }
  
  // Generate appropriate title based on service type
  const titles = {
    direct: ['Direct Therapy', 'ABA Session', 'Skills Training', 'Behavior Intervention'],
    indirect: ['Documentation', 'Prep Work', 'Program Planning', 'Data Review'],
    supervision: ['Supervision Meeting', 'Case Review', 'Training Session'],
    lunch: ['Lunch Break'],
    circle: ['Circle Time', 'Group Activity', 'Social Skills Group'],
    cleaning: ['Room Cleaning', 'Equipment Sanitization']
  };
  
  const title = faker.helpers.arrayElement(titles[serviceType] || titles.direct);
  
  // Build appointment data
  const appointmentData = {
    startTime,
    endTime,
    title,
    serviceType: serviceType || 'direct',
    status,
    notes: Math.random() > 0.6 ? faker.lorem.sentence() : null,
    recurring: false,
    excludeWeekends: true,
    excludeHolidays: true,
    therapistId: therapist.id,
    bcbaId: bcba.id,
    locationId: location.id
  };
  
  // CRITICAL: Only add patientId if the service type requires a patient
  if (patient && APPOINTMENT_TYPE_DISTRIBUTION[serviceType]?.requiresPatient === true) {
    appointmentData.patientId = patient.id;
  }
  // For service types that don't require a patient, patientId is NOT included
  
  return await db.Appointment.create(appointmentData);
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

// Helper function to create patient schedule data for the new scheduling system
async function createPatientScheduleData(orgPatients) {
  console.log('Creating patient schedule templates and time blocks...');
  
  const allPatients = [
    ...orgPatients.active,
    ...orgPatients.expiring,
    ...orgPatients.inactive
  ];
  
  const serviceTypes = ['assessment', 'intervention', 'parent-training', 'consultation'];
  const priorities = ['high', 'medium', 'low'];
  
  for (const patient of allPatients) {
    try {
      // Get locations for this patient's organization
      const patientLocations = await db.Location.findAll({ 
        where: { organizationId: patient.organizationId } 
      });
      
      if (patientLocations.length === 0) continue;
      
      // Create a patient schedule template (weekly pattern)
      const template = await db.PatientScheduleTemplate.create({
        name: `${patient.firstName} ${patient.lastName} Weekly Schedule`,
        patientId: patient.id,
        locationId: patientLocations[0].id, // Use first location
        effectiveStartDate: new Date(),
        effectiveEndDate: null, // Open-ended
        serviceType: faker.helpers.arrayElement(serviceTypes),
        totalWeeklyHours: faker.helpers.arrayElement([10, 15, 20, 25, 30]),
        createdById: patient.primaryBcbaId || 1, // Use primary BCBA or default to ID 1
        
        // Create a typical schedule (M-F with some variation)
        mondaySchedule: {
          startTime: '09:00',
          endTime: '12:00',
          enabled: true
        },
        tuesdaySchedule: {
          startTime: '09:00',
          endTime: '12:00',
          enabled: true
        },
        wednesdaySchedule: {
          startTime: '13:00',
          endTime: '16:00',
          enabled: Math.random() > 0.3
        },
        thursdaySchedule: {
          startTime: '09:00',
          endTime: '12:00',
          enabled: true
        },
        fridaySchedule: {
          startTime: '10:00',
          endTime: '13:00',
          enabled: Math.random() > 0.2
        },
        saturdaySchedule: {
          enabled: false
        },
        sundaySchedule: {
          enabled: false
        }
      });
      
      console.log(`Created schedule template for ${patient.firstName} ${patient.lastName}`);
      
      // Create time blocks for next 4 weeks
      const today = new Date();
      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        const weekStart = addDays(today, weekOffset * 7);
        
        // Create 3-5 time blocks per week
        const numBlocks = faker.number.int({ min: 3, max: 5 });
        
        for (let i = 0; i < numBlocks; i++) {
          const blockDate = addDays(weekStart, faker.number.int({ min: 0, max: 4 })); // Mon-Fri
          const blockHour = faker.number.int({ min: 8, max: 16 });
          const startTime = new Date(blockDate);
          startTime.setHours(blockHour, 0, 0, 0);
          
          const duration = faker.helpers.arrayElement([60, 90, 120]); // 1-2 hours
          const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
          
          await db.PatientTimeBlock.create({
            patientId: patient.id,
            scheduleTemplateId: template.id,
            blockDate: blockDate.toISOString().split('T')[0], // DATEONLY format
            startTime: `${String(blockHour).padStart(2, '0')}:00`, // HH:MM format
            endTime: `${String(blockHour + Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`, // HH:MM format
            durationMinutes: duration,
            priority: faker.helpers.arrayElement(priorities),
            isRecurring: Math.random() > 0.6,
            recurringPattern: Math.random() > 0.6 ? { frequency: 'weekly', interval: 1 } : null,
            locationId: faker.helpers.arrayElement(patientLocations).id,
            createdById: patient.primaryBcbaId || 1
          });
        }
      }
      
      console.log(`Created time blocks for ${patient.firstName} ${patient.lastName}`);
      
    } catch (error) {
      console.error(`Error creating schedule data for patient ${patient.firstName}:`, error);
    }
  }
  
  console.log('Patient schedule data creation completed');
}

// Run the seeding function
seedDatabase();

// Export for use in other scripts
module.exports = seedDatabase;