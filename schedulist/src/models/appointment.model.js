module.exports = (sequelize, DataTypes) => {
  const Appointment = sequelize.define('Appointment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'completed', 'cancelled', 'no-show'),
      defaultValue: 'scheduled',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    recurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    recurringPattern: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    excludeWeekends: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    excludeHolidays: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    therapistId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    bcbaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Patients',
        key: 'id'
      }
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Locations',
        key: 'id'
      }
    },
  }, {
    timestamps: true,
  });

  return Appointment;
};