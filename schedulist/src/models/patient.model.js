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
    approvedHours: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Total approved hours for ABA therapy (usually quarterly)'
    },
    approvedHoursStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Start date of approved hours period'
    },
    approvedHoursEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'End date of approved hours period'
    },
    usedHours: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0,
      comment: 'Hours used from approved hours'
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
    primaryBcbaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    // Schedule preferences and constraints
    preferredTherapistIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of preferred therapist UUIDs in priority order'
    },
    excludedTherapistIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of therapist UUIDs that should not be assigned'
    },
    defaultLocationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Locations',
        key: 'id'
      },
      comment: 'Default location for therapy sessions'
    },
    schedulingNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Special scheduling notes, preferences, or constraints'
    },
    // Schedule settings
    allowSplitSessions: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Allow multiple therapists for different time blocks in the same day'
    },
    preferredSessionDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
      comment: 'Preferred session duration in minutes'
    },
    minimumSessionDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Minimum acceptable session duration in minutes'
    },
    maximumSessionDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 240,
      comment: 'Maximum session duration in minutes (4 hours)'
    },
    // Availability constraints
    earliestStartTime: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Earliest time patient can start therapy (HH:MM format)'
    },
    latestEndTime: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Latest time patient can end therapy (HH:MM format)'
    },
    availableDays: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of available days: [0, 1, 2, 3, 4] where 0=Sunday, 1=Monday, etc.'
    },
    // Auto-scheduling preferences
    autoSchedulingEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Enable automatic scheduling for this patient'
    },
    schedulingPriority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium',
      comment: 'Priority level for scheduling (affects auto-assignment order)'
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
    try {
      const value = this.getDataValue(field);
      if (!value) return null;
      
      // Validate the encrypted value format
      if (typeof value !== 'string' || !value.includes(':')) {
        console.warn(`Invalid encrypted format for field ${field}:`, value);
        return this.getPlaceholderValue(field);
      }
      
      const key = getEncryptionKey();
      const textParts = value.split(':');
      
      // Ensure we have at least IV and encrypted text
      if (textParts.length < 2) {
        console.warn(`Invalid encrypted data structure for field ${field}`);
        return this.getPlaceholderValue(field);
      }
      
      const ivHex = textParts.shift();
      const encryptedText = textParts.join(':');
      
      // Validate IV format (should be 32 hex characters for 16 bytes)
      if (ivHex.length !== 32 || !/^[0-9a-f]+$/i.test(ivHex)) {
        console.warn(`Invalid IV format for field ${field}:`, ivHex);
        return this.getPlaceholderValue(field);
      }
      
      // Validate encrypted text is valid hex
      if (!/^[0-9a-f]+$/i.test(encryptedText)) {
        console.warn(`Invalid encrypted text format for field ${field}`);
        return this.getPlaceholderValue(field);
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error(`Failed to decrypt field ${field} for patient ${this.id}:`, {
        error: error.message,
        code: error.code,
        value: this.getDataValue(field)?.substring(0, 50) + '...' // Log first 50 chars for debugging
      });
      // Return a placeholder value instead of throwing
      return this.getPlaceholderValue(field);
    }
  };
  
  // Helper method to get appropriate placeholder values
  Patient.prototype.getPlaceholderValue = function(field) {
    const placeholders = {
      'encryptedFirstName': '[Encrypted First Name]',
      'encryptedLastName': '[Encrypted Last Name]',
      'encryptedDateOfBirth': '[Encrypted DOB]',
      'encryptedInsuranceProvider': '[Encrypted Insurance]',
      'encryptedInsuranceId': '[Encrypted Insurance ID]',
      'encryptedPhone': '[Encrypted Phone]',
      'encryptedAddress': '[Encrypted Address]'
    };
    
    return placeholders[field] || '[Encrypted Data]';
  };

  return Patient;
};