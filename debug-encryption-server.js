/**
 * Debug script to understand the encryption issue on the server
 * 
 * This simulates what happens when the Patient model tries to decrypt data
 */

require('dotenv').config({ path: './schedulist/.env' });
const crypto = require('crypto');

// Copy of the Patient model's encryption logic
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

// Copy of the Patient model's decryptField method
function decryptField(value, field) {
  try {
    if (!value) return null;
    
    // Validate the encrypted value format
    if (typeof value !== 'string' || !value.includes(':')) {
      console.warn(`Invalid encrypted format for field ${field}:`, value);
      return getPlaceholderValue(field);
    }
    
    const key = getEncryptionKey();
    const textParts = value.split(':');
    
    // Ensure we have at least IV and encrypted text
    if (textParts.length < 2) {
      console.warn(`Invalid encrypted data structure for field ${field}`);
      return getPlaceholderValue(field);
    }
    
    const ivHex = textParts.shift();
    const encryptedText = textParts.join(':');
    
    // Validate IV format (should be 32 hex characters for 16 bytes)
    if (ivHex.length !== 32 || !/^[0-9a-f]+$/i.test(ivHex)) {
      console.warn(`Invalid IV format for field ${field}:`, ivHex);
      return getPlaceholderValue(field);
    }
    
    // Validate encrypted text is valid hex
    if (!/^[0-9a-f]+$/i.test(encryptedText)) {
      console.warn(`Invalid encrypted text format for field ${field}`);
      return getPlaceholderValue(field);
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error(`Failed to decrypt field ${field}:`, {
      error: error.message,
      code: error.code,
      value: value?.substring(0, 50) + '...' // Log first 50 chars for debugging
    });
    // Return a placeholder value instead of throwing
    return getPlaceholderValue(field);
  }
}

// Copy of the Patient model's getPlaceholderValue method
function getPlaceholderValue(field) {
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
}

console.log('=== Server-Side Encryption Debug ===\n');

// Test with various scenarios
const testCases = [
  {
    name: 'Valid encrypted data (should work)',
    encryptedFirstName: '1234567890123456789012345678901:a1b2c3d4e5f6',
    encryptedLastName: '1234567890123456789012345678901:a1b2c3d4e5f6'
  },
  {
    name: 'Missing colon separator',
    encryptedFirstName: '1234567890123456789012345678901a1b2c3d4e5f6',
    encryptedLastName: '1234567890123456789012345678901a1b2c3d4e5f6'
  },
  {
    name: 'Invalid IV length',
    encryptedFirstName: '123:a1b2c3d4e5f6',
    encryptedLastName: '123:a1b2c3d4e5f6'
  },
  {
    name: 'Non-hex characters in IV',
    encryptedFirstName: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:a1b2c3d4e5f6',
    encryptedLastName: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:a1b2c3d4e5f6'
  },
  {
    name: 'Non-hex characters in encrypted text',
    encryptedFirstName: '1234567890123456789012345678901:notvalidhex!',
    encryptedLastName: '1234567890123456789012345678901:notvalidhex!'
  },
  {
    name: 'Null values',
    encryptedFirstName: null,
    encryptedLastName: null
  },
  {
    name: 'Empty strings',
    encryptedFirstName: '',
    encryptedLastName: ''
  }
];

console.log('Current ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY);
console.log('Key details:', {
  length: process.env.ENCRYPTION_KEY?.length,
  isHex: /^[0-9a-f]+$/i.test(process.env.ENCRYPTION_KEY || '')
});
console.log('\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log('Input:', {
    encryptedFirstName: testCase.encryptedFirstName,
    encryptedLastName: testCase.encryptedLastName
  });
  
  const firstName = decryptField(testCase.encryptedFirstName, 'encryptedFirstName');
  const lastName = decryptField(testCase.encryptedLastName, 'encryptedLastName');
  
  console.log('Output:', {
    firstName,
    lastName
  });
  console.log('---\n');
});

// Now test with a real encrypted value
console.log('=== Testing with Real Encryption ===\n');

function encrypt(text) {
  if (!text) return null;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text.toString(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

// Encrypt some test data
const encryptedJohn = encrypt('John');
const encryptedSmith = encrypt('Smith');

console.log('Encrypted "John":', encryptedJohn);
console.log('Encrypted "Smith":', encryptedSmith);

// Try to decrypt it
const decryptedJohn = decryptField(encryptedJohn, 'encryptedFirstName');
const decryptedSmith = decryptField(encryptedSmith, 'encryptedLastName');

console.log('\nDecrypted values:');
console.log('firstName:', decryptedJohn);
console.log('lastName:', decryptedSmith);
console.log('Success:', decryptedJohn === 'John' && decryptedSmith === 'Smith' ? '✅' : '❌');