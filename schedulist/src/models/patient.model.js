const crypto = require('crypto');
const { getEncryptionKey } = require('../utils/encryption');

module.exports = (sequelize, DataTypes) => {
  const Patient = sequelize.define('Patient', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Encrypted fields
    encryptedFirstName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    encryptedLastName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    encryptedDateOfBirth: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    encryptedInsuranceProvider: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    encryptedInsuranceId: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    encryptedPhone: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    encryptedAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Clinical info
    requiredWeeklyHours: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending', 'discharged'),
      defaultValue: 'active',
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    
    // Virtual fields that get decrypted
    firstName: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedFirstName');
      },
      set(value) {
        this.setDataValue('encryptedFirstName', this.encryptField(value));
      }
    },
    lastName: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedLastName');
      },
      set(value) {
        this.setDataValue('encryptedLastName', this.encryptField(value));
      }
    },
    dateOfBirth: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedDateOfBirth');
      },
      set(value) {
        this.setDataValue('encryptedDateOfBirth', this.encryptField(value));
      }
    },
    insuranceProvider: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedInsuranceProvider');
      },
      set(value) {
        this.setDataValue('encryptedInsuranceProvider', this.encryptField(value));
      }
    },
    insuranceId: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedInsuranceId');
      },
      set(value) {
        this.setDataValue('encryptedInsuranceId', this.encryptField(value));
      }
    },
    phone: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedPhone');
      },
      set(value) {
        this.setDataValue('encryptedPhone', this.encryptField(value));
      }
    },
    address: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedAddress');
      },
      set(value) {
        this.setDataValue('encryptedAddress', this.encryptField(value));
      }
    },
  }, {
    timestamps: true,
  });

  // Instance method to encrypt a field
  Patient.prototype.encryptField = function(value) {
    if (!value) return null;
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(value.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  };

  // Instance method to decrypt a field
  Patient.prototype.decryptField = function(field) {
    const value = this.getDataValue(field);
    if (!value) return null;
    
    const key = getEncryptionKey();
    const textParts = value.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  };

  return Patient;
};