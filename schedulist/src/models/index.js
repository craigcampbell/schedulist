const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/db.config')[env];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging,
    dialectOptions: config.dialectOptions,
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.User = require('./user.model')(sequelize, Sequelize);
db.Role = require('./role.model')(sequelize, Sequelize);
db.Patient = require('./patient.model')(sequelize, Sequelize);
db.Appointment = require('./appointment.model')(sequelize, Sequelize);
db.Note = require('./note.model')(sequelize, Sequelize);
db.Location = require('./location.model')(sequelize, Sequelize);
db.Organization = require('./organization.model')(sequelize);
db.Team = require('./team.model')(sequelize, Sequelize);
db.Audit = require('./audit.model')(sequelize, Sequelize);

// New scheduling models
db.PatientScheduleTemplate = require('./patientScheduleTemplate.model')(sequelize, Sequelize);
db.PatientTimeBlock = require('./patientTimeBlock.model')(sequelize, Sequelize);
db.TherapistAssignment = require('./therapistAssignment.model')(sequelize, Sequelize);
db.ScheduleCoverage = require('./scheduleCoverage.model')(sequelize, Sequelize);

// Call associate methods if they exist
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Define additional associations (Organization associations are handled by its associate method)

// Additional Organization relationships that are not in the associate method
db.User.belongsTo(db.Organization, { foreignKey: 'organizationId' });
db.Location.belongsTo(db.Organization, { foreignKey: 'organizationId' });

// User-Location many-to-many relationship (users can belong to multiple locations)
db.User.belongsToMany(db.Location, {
  through: 'UserLocations',
  as: 'Locations',
  foreignKey: 'userId'
});

db.Location.belongsToMany(db.User, {
  through: 'UserLocations',
  as: 'Users',
  foreignKey: 'locationId'
});

// Default location relationship
db.User.belongsTo(db.Location, {
  foreignKey: 'defaultLocationId',
  as: 'DefaultLocation'
});
db.Patient.belongsTo(db.Organization, { foreignKey: 'organizationId' });

// User and Role relationship (many-to-many)
db.User.belongsToMany(db.Role, { through: 'UserRoles' });
db.Role.belongsToMany(db.User, { through: 'UserRoles' });

// BCBA and Therapist relationships with Patients
db.User.belongsToMany(db.Patient, { through: 'UserPatients', as: 'Patients' });
db.Patient.belongsToMany(db.User, { through: 'UserPatients', as: 'Assignees' });

// Appointment relationships
db.Patient.hasMany(db.Appointment, { foreignKey: 'patientId' });
db.Appointment.belongsTo(db.Patient, { foreignKey: 'patientId' });

db.User.hasMany(db.Appointment, { as: 'TherapistAppointments', foreignKey: 'therapistId' });
db.Appointment.belongsTo(db.User, { as: 'Therapist', foreignKey: 'therapistId' });

db.User.hasMany(db.Appointment, { as: 'BCBAAppointments', foreignKey: 'bcbaId' });
db.Appointment.belongsTo(db.User, { as: 'BCBA', foreignKey: 'bcbaId' });

db.Location.hasMany(db.Appointment, { foreignKey: 'locationId' });
db.Appointment.belongsTo(db.Location, { foreignKey: 'locationId' });

// Primary BCBA relationship with Patient
db.User.hasMany(db.Patient, { as: 'PrimaryPatients', foreignKey: 'primaryBcbaId' });
db.Patient.belongsTo(db.User, { as: 'PrimaryBCBA', foreignKey: 'primaryBcbaId' });

// Default location relationship with Patient
db.Location.hasMany(db.Patient, { as: 'DefaultLocationPatients', foreignKey: 'defaultLocationId' });
db.Patient.belongsTo(db.Location, { as: 'DefaultLocation', foreignKey: 'defaultLocationId' });

// Note relationships
db.Patient.hasMany(db.Note);
db.Note.belongsTo(db.Patient);

db.User.hasMany(db.Note, { foreignKey: 'authorId' });
db.Note.belongsTo(db.User, { as: 'Author', foreignKey: 'authorId' });

// Team relationships - User side only (Team side is handled in Team.associate)
db.User.hasMany(db.Team, { foreignKey: 'leadBcbaId', as: 'LedTeams' });

// Patient Schedule Template relationships
db.Patient.hasMany(db.PatientScheduleTemplate, { foreignKey: 'patientId', as: 'ScheduleTemplates' });
db.PatientScheduleTemplate.belongsTo(db.Patient, { foreignKey: 'patientId' });

db.Location.hasMany(db.PatientScheduleTemplate, { foreignKey: 'locationId', as: 'PatientScheduleTemplates' });
db.PatientScheduleTemplate.belongsTo(db.Location, { foreignKey: 'locationId' });

db.User.hasMany(db.PatientScheduleTemplate, { foreignKey: 'createdById', as: 'CreatedScheduleTemplates' });
db.PatientScheduleTemplate.belongsTo(db.User, { foreignKey: 'createdById', as: 'CreatedBy' });

db.User.hasMany(db.PatientScheduleTemplate, { foreignKey: 'updatedById', as: 'UpdatedScheduleTemplates' });
db.PatientScheduleTemplate.belongsTo(db.User, { foreignKey: 'updatedById', as: 'UpdatedBy' });

// Patient Time Block relationships
db.Patient.hasMany(db.PatientTimeBlock, { foreignKey: 'patientId', as: 'TimeBlocks' });
db.PatientTimeBlock.belongsTo(db.Patient, { foreignKey: 'patientId' });

db.PatientScheduleTemplate.hasMany(db.PatientTimeBlock, { foreignKey: 'scheduleTemplateId', as: 'TimeBlocks' });
db.PatientTimeBlock.belongsTo(db.PatientScheduleTemplate, { foreignKey: 'scheduleTemplateId', as: 'ScheduleTemplate' });

db.Location.hasMany(db.PatientTimeBlock, { foreignKey: 'locationId', as: 'PatientTimeBlocks' });
db.PatientTimeBlock.belongsTo(db.Location, { foreignKey: 'locationId' });

db.User.hasMany(db.PatientTimeBlock, { foreignKey: 'createdById', as: 'CreatedTimeBlocks' });
db.PatientTimeBlock.belongsTo(db.User, { foreignKey: 'createdById', as: 'CreatedBy' });

db.User.hasMany(db.PatientTimeBlock, { foreignKey: 'updatedById', as: 'UpdatedTimeBlocks' });
db.PatientTimeBlock.belongsTo(db.User, { foreignKey: 'updatedById', as: 'UpdatedBy' });

// Therapist Assignment relationships
db.PatientTimeBlock.hasMany(db.TherapistAssignment, { foreignKey: 'patientTimeBlockId', as: 'Assignments' });
db.TherapistAssignment.belongsTo(db.PatientTimeBlock, { foreignKey: 'patientTimeBlockId', as: 'TimeBlock' });

db.User.hasMany(db.TherapistAssignment, { foreignKey: 'therapistId', as: 'TherapistAssignments' });
db.TherapistAssignment.belongsTo(db.User, { foreignKey: 'therapistId', as: 'Therapist' });

db.Patient.hasMany(db.TherapistAssignment, { foreignKey: 'patientId', as: 'TherapistAssignments' });
db.TherapistAssignment.belongsTo(db.Patient, { foreignKey: 'patientId' });

db.Location.hasMany(db.TherapistAssignment, { foreignKey: 'locationId', as: 'TherapistAssignments' });
db.TherapistAssignment.belongsTo(db.Location, { foreignKey: 'locationId' });

db.Appointment.hasOne(db.TherapistAssignment, { foreignKey: 'appointmentId', as: 'Assignment' });
db.TherapistAssignment.belongsTo(db.Appointment, { foreignKey: 'appointmentId' });

db.User.hasMany(db.TherapistAssignment, { foreignKey: 'createdById', as: 'CreatedAssignments' });
db.TherapistAssignment.belongsTo(db.User, { foreignKey: 'createdById', as: 'CreatedBy' });

db.User.hasMany(db.TherapistAssignment, { foreignKey: 'updatedById', as: 'UpdatedAssignments' });
db.TherapistAssignment.belongsTo(db.User, { foreignKey: 'updatedById', as: 'UpdatedBy' });

db.User.hasMany(db.TherapistAssignment, { foreignKey: 'assignedById', as: 'MadeAssignments' });
db.TherapistAssignment.belongsTo(db.User, { foreignKey: 'assignedById', as: 'AssignedBy' });

// Self-referencing relationship for assignment continuity
db.TherapistAssignment.hasOne(db.TherapistAssignment, { foreignKey: 'previousAssignmentId', as: 'NextAssignment' });
db.TherapistAssignment.belongsTo(db.TherapistAssignment, { foreignKey: 'previousAssignmentId', as: 'PreviousAssignment' });

// Schedule Coverage relationships
db.Patient.hasMany(db.ScheduleCoverage, { foreignKey: 'patientId', as: 'ScheduleCoverages' });
db.ScheduleCoverage.belongsTo(db.Patient, { foreignKey: 'patientId' });

db.Location.hasMany(db.ScheduleCoverage, { foreignKey: 'locationId', as: 'ScheduleCoverages' });
db.ScheduleCoverage.belongsTo(db.Location, { foreignKey: 'locationId' });

db.User.hasMany(db.ScheduleCoverage, { foreignKey: 'primaryTherapistId', as: 'PrimaryCoverages' });
db.ScheduleCoverage.belongsTo(db.User, { foreignKey: 'primaryTherapistId', as: 'PrimaryTherapist' });

db.User.hasMany(db.ScheduleCoverage, { foreignKey: 'createdById', as: 'CreatedCoverages' });
db.ScheduleCoverage.belongsTo(db.User, { foreignKey: 'createdById', as: 'CreatedBy' });

// Self-referencing relationship for coverage history
db.ScheduleCoverage.hasOne(db.ScheduleCoverage, { foreignKey: 'previousCoverageId', as: 'NextCoverage' });
db.ScheduleCoverage.belongsTo(db.ScheduleCoverage, { foreignKey: 'previousCoverageId', as: 'PreviousCoverage' });

// Team relationships - reverse association for User
db.User.belongsToMany(db.Team, {
  through: 'TeamMembers',
  as: 'Teams',
  foreignKey: 'userId'
});

// Patient-Team relationship
db.Patient.belongsTo(db.Team, {
  foreignKey: 'teamId',
  as: 'Team'
});

db.Team.hasMany(db.Patient, {
  foreignKey: 'teamId',
  as: 'Patients'
});

// Appointment-Team relationship
db.Appointment.belongsTo(db.Team, {
  foreignKey: 'teamId',
  as: 'Team'
});

db.Team.hasMany(db.Appointment, {
  foreignKey: 'teamId',
  as: 'Appointments'
});

// Audit relationships
db.User.hasMany(db.Audit, { 
  foreignKey: 'changedById', 
  as: 'AuditTrail' 
});
db.Audit.belongsTo(db.User, { 
  foreignKey: 'changedById', 
  as: 'ChangedBy' 
});

db.Organization.hasMany(db.Audit, { 
  foreignKey: 'organizationId', 
  as: 'AuditLogs' 
});
db.Audit.belongsTo(db.Organization, { 
  foreignKey: 'organizationId' 
});

module.exports = db;