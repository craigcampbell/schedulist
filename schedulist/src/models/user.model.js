const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
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
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    isSuperAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    inviteToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    inviteExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    defaultLocationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Locations',
        key: 'id'
      }
    },
    slackUserId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    videoLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Billing / credentialing fields (added via migration 20250721000000)
    npi: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'National Provider Identifier (10-digit)',
    },
    credentials: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'e.g. "BCBA, LBA" or "RBT"',
    },
    providerLevel: {
      type: DataTypes.ENUM('paraprofessional', 'bachelor', 'master', 'doctorate'),
      allowNull: true,
      comment: 'Determines billing modifier: HM/HN/HO',
    },
    // Insurance & credentialing (added via migration 20250722000000)
    insurancePanels: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Insurance companies this provider is credentialed/paneled with',
    },
    certifications: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Professional certifications held by this provider',
    },
  }, {
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  });

  // Instance method to check password validity
  User.prototype.isValidPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  return User;
};