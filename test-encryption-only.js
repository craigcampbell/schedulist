/**
 * Simple encryption test without database
 */

require('dotenv').config({ path: './schedulist/.env' });
const crypto = require('crypto');

/**
 * Get the encryption key from environment variables or derive it
 */
const getEncryptionKey = () => {
  const keyFromEnv = process.env.ENCRYPTION_KEY;
  
  if (!keyFromEnv) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  console.log('Encryption key from env:', keyFromEnv);
  console.log('Key length:', keyFromEnv.length);
  console.log('Is hex format?', /^[0-9a-f]+$/i.test(keyFromEnv));
  
  // If key is already 32 bytes (64 hex chars), use it directly
  if (keyFromEnv.length === 64 && /^[0-9a-f]+$/i.test(keyFromEnv)) {
    console.log('✅ Using hex key directly');
    return Buffer.from(keyFromEnv, 'hex');
  }
  
  // Otherwise derive a 32-byte key using PBKDF2
  console.log('⚠️  Deriving key using PBKDF2...');
  return crypto.pbkdf2Sync(
    keyFromEnv,
    'schedulist-salt',
    10000,
    32,
    'sha256'
  );
};

/**
 * Encrypt a string value (matching patient model logic)
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
 * Decrypt an encrypted string (matching patient model logic)
 */
const decrypt = (encryptedText) => {
  try {
    if (!encryptedText) return null;
    
    // Validate the encrypted value format
    if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
      console.log('Invalid format (no colon separator)');
      return '[Encrypted Data]';
    }
    
    const key = getEncryptionKey();
    const textParts = encryptedText.split(':');
    
    if (textParts.length < 2) {
      console.log('Invalid structure (not enough parts)');
      return '[Encrypted Data]';
    }
    
    const ivHex = textParts.shift();
    const encryptedData = textParts.join(':');
    
    // Validate IV format
    if (ivHex.length !== 32 || !/^[0-9a-f]+$/i.test(ivHex)) {
      console.log('Invalid IV format');
      return '[Encrypted Data]';
    }
    
    // Validate encrypted text is valid hex
    if (!/^[0-9a-f]+$/i.test(encryptedData)) {
      console.log('Invalid encrypted text format');
      return '[Encrypted Data]';
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return '[Encrypted Data]';
  }
};

console.log('=== Testing Encryption/Decryption ===\n');

try {
  // Check encryption key
  const key = getEncryptionKey();
  console.log(`Key buffer length: ${key.length} bytes (should be 32)\n`);
  
  // Test cases
  const testValues = ['John', 'Smith', 'Jane', 'Doe', 'Test Patient'];
  
  console.log('--- Encrypting and Decrypting Test Values ---');
  for (const value of testValues) {
    console.log(`\nOriginal: "${value}"`);
    const encrypted = encrypt(value);
    console.log(`Encrypted: ${encrypted.substring(0, 60)}...`);
    const decrypted = decrypt(encrypted);
    console.log(`Decrypted: "${decrypted}"`);
    console.log(`Result: ${value === decrypted ? '✅ SUCCESS' : '❌ FAILED'}`);
  }
  
  // Test with some example encrypted values from your error
  console.log('\n--- Testing Placeholder Detection ---');
  const badValues = [
    null,
    '',
    'invalid-no-colon',
    'short:data',
    'invalidiv:1234567890abcdef',
    '12345678901234567890123456789012:notvalidhex!'
  ];
  
  for (const badValue of badValues) {
    console.log(`\nTesting bad value: ${JSON.stringify(badValue)}`);
    const result = decrypt(badValue);
    console.log(`Result: "${result}"`);
  }
  
} catch (error) {
  console.error('Test failed:', error);
}