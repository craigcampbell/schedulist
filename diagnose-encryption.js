/**
 * Diagnostic script to fix patient name encryption issues
 * 
 * This script helps identify and fix issues with patient name encryption/decryption
 */

require('dotenv').config({ path: './schedulist/.env' });
const { Sequelize } = require('sequelize');
const crypto = require('crypto');

// Get database config
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'schedulist_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'your-db-password',
  dialect: 'postgres',
  logging: false
};

// Create sequelize instance
const sequelize = new Sequelize(dbConfig);

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
    return Buffer.from(keyFromEnv, 'hex');
  }
  
  // Otherwise derive a 32-byte key using PBKDF2
  console.log('Deriving key using PBKDF2...');
  return crypto.pbkdf2Sync(
    keyFromEnv,
    'schedulist-salt',
    10000,
    32,
    'sha256'
  );
};

/**
 * Test decryption of a value
 */
const testDecrypt = (encryptedText, fieldName) => {
  try {
    if (!encryptedText) {
      console.log(`  ${fieldName}: No value to decrypt`);
      return null;
    }
    
    // Validate the encrypted value format
    if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
      console.log(`  ${fieldName}: Invalid format (no colon separator)`);
      return null;
    }
    
    const key = getEncryptionKey();
    const textParts = encryptedText.split(':');
    
    if (textParts.length < 2) {
      console.log(`  ${fieldName}: Invalid structure (not enough parts)`);
      return null;
    }
    
    const ivHex = textParts.shift();
    const encryptedData = textParts.join(':');
    
    // Validate IV format
    if (ivHex.length !== 32 || !/^[0-9a-f]+$/i.test(ivHex)) {
      console.log(`  ${fieldName}: Invalid IV format`);
      return null;
    }
    
    // Validate encrypted text is valid hex
    if (!/^[0-9a-f]+$/i.test(encryptedData)) {
      console.log(`  ${fieldName}: Invalid encrypted text format`);
      return null;
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log(`  ${fieldName}: Successfully decrypted - "${decrypted}"`);
    return decrypted;
  } catch (error) {
    console.log(`  ${fieldName}: Decryption failed - ${error.message}`);
    return null;
  }
};

/**
 * Test encryption and immediate decryption
 */
const testEncryptDecrypt = (text) => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const fullEncrypted = iv.toString('hex') + ':' + encrypted;
    console.log(`\nTest encrypt "${text}": ${fullEncrypted.substring(0, 50)}...`);
    
    // Now decrypt it
    const result = testDecrypt(fullEncrypted, 'Test Value');
    console.log(`Test decrypt result: ${result === text ? 'SUCCESS' : 'FAILED'}`);
    
    return fullEncrypted;
  } catch (error) {
    console.log(`Test encrypt/decrypt failed: ${error.message}`);
    return null;
  }
};

async function diagnoseEncryption() {
  console.log('=== Patient Name Encryption Diagnostic ===\n');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Check encryption key
    console.log('--- Checking Encryption Key ---');
    try {
      const key = getEncryptionKey();
      console.log('✅ Encryption key loaded successfully');
      console.log(`Key buffer length: ${key.length} bytes (should be 32)\n`);
    } catch (error) {
      console.log('❌ Failed to load encryption key:', error.message);
      return;
    }
    
    // Test encryption/decryption
    console.log('--- Testing Encryption/Decryption ---');
    testEncryptDecrypt('John');
    testEncryptDecrypt('Smith');
    
    // Query patients directly
    console.log('\n--- Checking Patient Data ---');
    const [patients] = await sequelize.query(`
      SELECT 
        id, 
        "encryptedFirstName",
        "encryptedLastName",
        "createdAt"
      FROM "Patients"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);
    
    console.log(`\nFound ${patients.length} recent patients\n`);
    
    for (const patient of patients) {
      console.log(`Patient ID: ${patient.id}`);
      console.log(`Created: ${patient.createdAt}`);
      console.log(`Encrypted First Name: ${patient.encryptedFirstName ? patient.encryptedFirstName.substring(0, 50) + '...' : 'NULL'}`);
      console.log(`Encrypted Last Name: ${patient.encryptedLastName ? patient.encryptedLastName.substring(0, 50) + '...' : 'NULL'}`);
      
      // Try to decrypt
      console.log('Decryption results:');
      testDecrypt(patient.encryptedFirstName, 'firstName');
      testDecrypt(patient.encryptedLastName, 'lastName');
      console.log('---\n');
    }
    
    // Check if we need to re-encrypt data
    console.log('--- Recommendations ---');
    console.log('1. Ensure ENCRYPTION_KEY in .env matches the key used when data was encrypted');
    console.log('2. If you changed the encryption key, you need to re-encrypt all patient data');
    console.log('3. Check server logs for decryption warnings when accessing patient data');
    console.log('\nTo re-encrypt patient data with a new key:');
    console.log('1. Decrypt all data with the OLD key');
    console.log('2. Update ENCRYPTION_KEY in .env to the NEW key');
    console.log('3. Re-encrypt all data with the NEW key');
    
  } catch (error) {
    console.error('Diagnostic failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Add option to re-encrypt data
async function reEncryptPatientData(oldKey, newKey) {
  console.log('\n=== Re-encrypting Patient Data ===\n');
  
  try {
    // This would decrypt with old key and encrypt with new key
    // Implementation depends on how you want to handle this
    console.log('Re-encryption not implemented in this diagnostic script');
    console.log('This would require careful handling to avoid data loss');
  } catch (error) {
    console.error('Re-encryption failed:', error);
  }
}

// Run diagnostics
diagnoseEncryption();