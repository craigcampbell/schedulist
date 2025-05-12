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

// Define associations

// Organization relationships
db.Organization.hasMany(db.User, { foreignKey: 'organizationId', as: 'users' });
db.User.belongsTo(db.Organization, { foreignKey: 'organizationId' });

db.Organization.hasMany(db.Location, { foreignKey: 'organizationId', as: 'locations' });
db.Location.belongsTo(db.Organization, { foreignKey: 'organizationId' });

db.Organization.hasMany(db.Patient, { foreignKey: 'organizationId', as: 'patients' });
db.Patient.belongsTo(db.Organization, { foreignKey: 'organizationId' });

// User and Role relationship (many-to-many)
db.User.belongsToMany(db.Role, { through: 'UserRoles' });
db.Role.belongsToMany(db.User, { through: 'UserRoles' });

// BCBA and Therapist relationships with Patients
db.User.belongsToMany(db.Patient, { through: 'UserPatients', as: 'Patients' });
db.Patient.belongsToMany(db.User, { through: 'UserPatients', as: 'Assignees' });

// Appointment relationships
db.Patient.hasMany(db.Appointment);
db.Appointment.belongsTo(db.Patient);

db.User.hasMany(db.Appointment, { as: 'TherapistAppointments', foreignKey: 'therapistId' });
db.Appointment.belongsTo(db.User, { as: 'Therapist', foreignKey: 'therapistId' });

db.User.hasMany(db.Appointment, { as: 'BCBAAppointments', foreignKey: 'bcbaId' });
db.Appointment.belongsTo(db.User, { as: 'BCBA', foreignKey: 'bcbaId' });

db.Location.hasMany(db.Appointment);
db.Appointment.belongsTo(db.Location);

// Primary BCBA relationship with Patient
db.User.hasMany(db.Patient, { as: 'PrimaryPatients', foreignKey: 'primaryBcbaId' });
db.Patient.belongsTo(db.User, { as: 'PrimaryBCBA', foreignKey: 'primaryBcbaId' });

// Note relationships
db.Patient.hasMany(db.Note);
db.Note.belongsTo(db.Patient);

db.User.hasMany(db.Note, { foreignKey: 'authorId' });
db.Note.belongsTo(db.User, { as: 'Author', foreignKey: 'authorId' });

// Team relationships
db.User.hasMany(db.Team, { foreignKey: 'leadBcbaId', as: 'LedTeams' });
db.Team.belongsTo(db.User, { foreignKey: 'leadBcbaId', as: 'LeadBCBA' });

db.User.belongsToMany(db.Team, { through: 'TeamMembers', as: 'Teams', foreignKey: 'userId' });
db.Team.belongsToMany(db.User, { through: 'TeamMembers', as: 'Members', foreignKey: 'teamId' });

module.exports = db;