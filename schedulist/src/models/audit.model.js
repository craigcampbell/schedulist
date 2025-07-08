const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const Audit = sequelize.define('Audit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'The type of entity being audited (e.g., User, Appointment, Patient)'
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'The ID of the entity being audited'
    },
    action: {
      type: DataTypes.ENUM('create', 'update', 'delete', 'password_change', 'login', 'logout', 'permission_change'),
      allowNull: false,
      comment: 'The type of action performed'
    },
    fieldName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'The specific field that was changed (null for create/delete actions)'
    },
    oldValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Previous value (encrypted for sensitive data)'
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'New value (encrypted for sensitive data)'
    },
    changedById: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'User who made the change'
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Organization context for the audit'
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'IP address of the user making the change'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent/browser information'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional context-specific data'
    }
  }, {
    tableName: 'Audits',
    timestamps: true,
    updatedAt: false, // Audit records should never be updated
    indexes: [
      {
        fields: ['entityType', 'entityId']
      },
      {
        fields: ['changedById']
      },
      {
        fields: ['organizationId']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['action']
      }
    ]
  });

  // Sensitive fields that should be encrypted
  const SENSITIVE_FIELDS = ['password', 'ssn', 'dateOfBirth', 'medicalInfo'];
  
  // Simple encryption for sensitive data (in production, use proper key management)
  const encryptSensitiveValue = (value, fieldName) => {
    if (!value || !SENSITIVE_FIELDS.includes(fieldName)) {
      return value;
    }
    
    // For passwords, never store the actual value, just indicate it was changed
    if (fieldName === 'password') {
      return '***CHANGED***';
    }
    
    // For other sensitive fields, encrypt them
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.AUDIT_ENCRYPTION_KEY || 'default-key-change-in-production', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  };

  // Helper method to create audit log
  Audit.log = async function(data) {
    const { entityType, entityId, action, fieldName, oldValue, newValue, userId, organizationId, req } = data;
    
    // Extract request information if provided
    let ipAddress = null;
    let userAgent = null;
    
    if (req) {
      ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
      userAgent = req.headers['user-agent'];
    }
    
    // Encrypt sensitive values if needed
    const encryptedOldValue = oldValue ? encryptSensitiveValue(String(oldValue), fieldName) : null;
    const encryptedNewValue = newValue ? encryptSensitiveValue(String(newValue), fieldName) : null;
    
    return await this.create({
      entityType,
      entityId,
      action,
      fieldName,
      oldValue: encryptedOldValue,
      newValue: encryptedNewValue,
      changedById: userId,
      organizationId,
      ipAddress,
      userAgent,
      metadata: data.metadata || {}
    });
  };

  // Helper method to log multiple field changes
  Audit.logBulk = async function(entityType, entityId, changes, userId, organizationId, req) {
    const auditEntries = changes.map(change => ({
      entityType,
      entityId,
      action: 'update',
      fieldName: change.fieldName,
      oldValue: change.oldValue ? encryptSensitiveValue(String(change.oldValue), change.fieldName) : null,
      newValue: change.newValue ? encryptSensitiveValue(String(change.newValue), change.fieldName) : null,
      changedById: userId,
      organizationId,
      ipAddress: req?.ip || req?.connection?.remoteAddress || req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent'],
      metadata: change.metadata || {}
    }));
    
    return await this.bulkCreate(auditEntries);
  };

  return Audit;
};