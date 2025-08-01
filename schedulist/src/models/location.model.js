module.exports = (sequelize, DataTypes) => {
  const Location = sequelize.define('Location', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    zipCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    workingHoursStart: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '08:00',  // Default 8 AM
    },
    workingHoursEnd: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '17:00',  // Default 5 PM
    },
    slotDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,  // Default 30-minute slots
      validate: {
        isIn: [[30, 60]]  // Only allow 30 or 60 minute slots
      }
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
  }, {
    timestamps: true,
  });

  return Location;
};