const crypto = require('crypto');
require('dotenv').config();

/**
 * Get the encryption key from environment variables or derive it
 * @returns {Buffer} The encryption key as a buffer
 */
const getEncryptionKey = () => {
  const keyFromEnv = process.env.ENCRYPTION_KEY;
  
  if (!keyFromEnv) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  // If key is already 32 bytes (64 hex chars), use it directly
  if (keyFromEnv.length === 64 && /^[0-9a-f]+$/i.test(keyFromEnv)) {
    return Buffer.from(keyFromEnv, 'hex');
  }
  
  // Otherwise derive a 32-byte key using PBKDF2
  return crypto.pbkdf2Sync(
    keyFromEnv,
    'schedulist-salt',
    10000,
    32,
    'sha256'
  );
};

/**
 * Encrypt a string value
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text with IV prepended, hex encoded
 */
const encrypt = (text) => {
  if (!text) return null;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text.toString(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Encrypted text with IV prepended, hex encoded
 * @returns {string} - Decrypted text
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  
  const key = getEncryptionKey();
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedData = textParts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

module.exports = {
  getEncryptionKey,
  encrypt,
  decrypt
};