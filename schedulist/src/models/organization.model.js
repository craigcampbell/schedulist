const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Organization extends Model {
    static associate(models) {
      // Organization has many users
      this.hasMany(models.User, {
        foreignKey: 'organizationId',
        as: 'users'
      });
      
      // Organization has many locations
      this.hasMany(models.Location, {
        foreignKey: 'organizationId',
        as: 'locations'
      });
      
      // Organization has many patients through locations
      this.hasMany(models.Patient, {
        foreignKey: 'organizationId',
        as: 'patients'
      });
    }
  }
  
  Organization.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9\-]+$/i // Only allow letters, numbers and hyphens
      }
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Subscription related fields
    subscriptionActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    subscriptionTier: {
      type: DataTypes.STRING,
      defaultValue: 'free'
    },
    subscriptionStartDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    subscriptionEndDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paidLocationsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    includedUsersCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    additionalUsersCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    monthlyRate: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Organization',
    tableName: 'organizations',
    hooks: {
      beforeCreate: (organization) => {
        // Generate slug from name if not provided
        if (!organization.slug) {
          organization.slug = organization.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .substring(0, 50);
        }
      }
    }
  });

  return Organization;
};