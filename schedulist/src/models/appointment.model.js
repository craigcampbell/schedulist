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
    serviceType: {
      type: DataTypes.ENUM('direct', 'indirect', 'supervision', 'noOw', 'lunch', 'circle', 'cleaning'),
      allowNull: false,
      defaultValue: 'direct'
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
      allowNull: true, // Allow null for unassigned appointments
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
      allowNull: true, // Allow null for non-patient activities like lunch
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
    teamId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Teams',
        key: 'id'
      },
      comment: 'Team associated with this appointment (from patient)'
    },

    // ── Billing fields (added via migration 20250721000000) ──────────────────
    billingStatus: {
      type: DataTypes.ENUM('unbilled', 'ready', 'submitted', 'paid', 'denied', 'void'),
      defaultValue: 'unbilled',
      allowNull: false,
    },
    cptCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'CPT code override; auto-computed if null',
    },
    diagnosisCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    modifiers: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    placeOfServiceCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    billedUnits: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    billedAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    claimNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    authorizationNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    billingNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    timestamps: true,
  });

  return Appointment;
};