const crypto = require('crypto');
const { getEncryptionKey } = require('../utils/encryption');

module.exports = (sequelize, DataTypes) => {
  const Note = sequelize.define('Note', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    encryptedContent: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    noteType: {
      type: DataTypes.ENUM('session', 'progress', 'assessment', 'general'),
      defaultValue: 'session',
    },
    sessionDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    authorId: {
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
    // Virtual field for decrypted content
    content: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.decryptField('encryptedContent');
      },
      set(value) {
        this.setDataValue('encryptedContent', this.encryptField(value));
      }
    },
  }, {
    timestamps: true,
  });

  // Instance method to encrypt a field
  Note.prototype.encryptField = function(value) {
    if (!value) return null;
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(value.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  };

  // Instance method to decrypt a field
  Note.prototype.decryptField = function(field) {
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

  return Note;
};