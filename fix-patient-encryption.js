/**
 * Script to fix patient encryption issues
 * 
 * This script can:
 * 1. Check current encryption status
 * 2. Re-encrypt patient data with proper values
 * 3. Handle migration from one encryption key to another
 */

require('dotenv').config({ path: './schedulist/.env' });
const readline = require('readline');
const { Sequelize, DataTypes } = require('sequelize');
const crypto = require('crypto');

// Database connection
const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'schedulist_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'your-db-password',
  dialect: 'postgres',
  logging: false
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

/**
 * Get encryption key
 */
const getEncryptionKey = (keyString) => {
  if (!keyString) {
    throw new Error('Encryption key is empty');
  }
  
  // If key is already 32 bytes (64 hex chars), use it directly
  if (keyString.length === 64 && /^[0-9a-f]+$/i.test(keyString)) {
    return Buffer.from(keyString, 'hex');
  }
  
  // Otherwise derive a 32-byte key using PBKDF2
  return crypto.pbkdf2Sync(keyString, 'schedulist-salt', 10000, 32, 'sha256');
};

/**
 * Encrypt a value
 */
const encrypt = (text, key) => {
  if (!text) return null;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text.toString(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Try to decrypt a value
 */
const tryDecrypt = (encryptedText, key) => {
  try {
    if (!encryptedText) return { success: false, value: null, error: 'No value' };
    
    if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
      return { success: false, value: null, error: 'Invalid format' };
    }
    
    const textParts = encryptedText.split(':');
    if (textParts.length < 2) {
      return { success: false, value: null, error: 'Invalid structure' };
    }
    
    const ivHex = textParts.shift();
    const encryptedData = textParts.join(':');
    
    if (ivHex.length !== 32 || !/^[0-9a-f]+$/i.test(ivHex)) {
      return { success: false, value: null, error: 'Invalid IV' };
    }
    
    if (!/^[0-9a-f]+$/i.test(encryptedData)) {
      return { success: false, value: null, error: 'Invalid encrypted data' };
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return { success: true, value: decrypted, error: null };
  } catch (error) {
    return { success: false, value: null, error: error.message };
  }
};

async function main() {
  console.log('=== Patient Encryption Fix Tool ===\n');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Get current encryption key
    const currentKeyString = process.env.ENCRYPTION_KEY;
    if (!currentKeyString) {
      console.error('❌ ENCRYPTION_KEY not found in .env file');
      process.exit(1);
    }
    
    const currentKey = getEncryptionKey(currentKeyString);
    console.log('Current encryption key loaded from .env\n');
    
    // Check patient data
    const [patients] = await sequelize.query(`
      SELECT id, "encryptedFirstName", "encryptedLastName" 
      FROM "Patients" 
      ORDER BY "createdAt" DESC
    `);
    
    console.log(`Found ${patients.length} patients\n`);
    
    // Analyze encryption status
    let successCount = 0;
    let failureCount = 0;
    const failures = [];
    
    for (const patient of patients) {
      const firstNameResult = tryDecrypt(patient.encryptedFirstName, currentKey);
      const lastNameResult = tryDecrypt(patient.encryptedLastName, currentKey);
      
      if (firstNameResult.success && lastNameResult.success) {
        successCount++;
      } else {
        failureCount++;
        failures.push({
          id: patient.id,
          firstNameError: firstNameResult.error,
          lastNameError: lastNameResult.error
        });
      }
    }
    
    console.log(`Decryption results:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}\n`);
    
    if (failureCount === 0) {
      console.log('All patient names are properly encrypted and decryptable!');
      console.log('If you\'re still seeing "[Encrypted FirstName]" in the app, check:');
      console.log('1. The server is restarted after .env changes');
      console.log('2. The server logs for any errors');
      process.exit(0);
    }
    
    // Show some failure examples
    console.log('Sample failures:');
    failures.slice(0, 3).forEach(f => {
      console.log(`- Patient ${f.id}: firstName: ${f.firstNameError}, lastName: ${f.lastNameError}`);
    });
    
    console.log('\nOptions:');
    console.log('1. Re-encrypt with placeholder names (for testing)');
    console.log('2. Try decryption with a different key');
    console.log('3. Clear encrypted data (set to NULL)');
    console.log('4. Exit');
    
    const choice = await question('\nSelect option (1-4): ');
    
    switch (choice) {
      case '1':
        // Re-encrypt with test data
        console.log('\n⚠️  WARNING: This will replace all patient names with test data!');
        const confirm1 = await question('Are you sure? (yes/no): ');
        
        if (confirm1.toLowerCase() === 'yes') {
          let updated = 0;
          for (const patient of patients) {
            const testFirstName = `Test${updated + 1}`;
            const testLastName = `Patient${updated + 1}`;
            
            const encFirstName = encrypt(testFirstName, currentKey);
            const encLastName = encrypt(testLastName, currentKey);
            
            await sequelize.query(`
              UPDATE "Patients" 
              SET "encryptedFirstName" = :firstName, "encryptedLastName" = :lastName
              WHERE id = :id
            `, {
              replacements: {
                firstName: encFirstName,
                lastName: encLastName,
                id: patient.id
              }
            });
            
            updated++;
            if (updated % 10 === 0) {
              console.log(`Updated ${updated} patients...`);
            }
          }
          console.log(`\n✅ Updated ${updated} patients with test names`);
        }
        break;
        
      case '2':
        // Try different key
        console.log('\nEnter the encryption key that was used to encrypt the data:');
        const oldKeyString = await question('Old encryption key: ');
        
        try {
          const oldKey = getEncryptionKey(oldKeyString);
          let successWithOldKey = 0;
          
          for (const patient of patients) {
            const firstNameResult = tryDecrypt(patient.encryptedFirstName, oldKey);
            const lastNameResult = tryDecrypt(patient.encryptedLastName, oldKey);
            
            if (firstNameResult.success && lastNameResult.success) {
              successWithOldKey++;
            }
          }
          
          console.log(`\nDecryption with old key: ${successWithOldKey}/${patients.length} successful`);
          
          if (successWithOldKey > 0) {
            const migrate = await question('\nMigrate data to current key? (yes/no): ');
            
            if (migrate.toLowerCase() === 'yes') {
              let migrated = 0;
              for (const patient of patients) {
                const firstNameResult = tryDecrypt(patient.encryptedFirstName, oldKey);
                const lastNameResult = tryDecrypt(patient.encryptedLastName, oldKey);
                
                if (firstNameResult.success && lastNameResult.success) {
                  const newEncFirstName = encrypt(firstNameResult.value, currentKey);
                  const newEncLastName = encrypt(lastNameResult.value, currentKey);
                  
                  await sequelize.query(`
                    UPDATE "Patients" 
                    SET "encryptedFirstName" = :firstName, "encryptedLastName" = :lastName
                    WHERE id = :id
                  `, {
                    replacements: {
                      firstName: newEncFirstName,
                      lastName: newEncLastName,
                      id: patient.id
                    }
                  });
                  
                  migrated++;
                }
              }
              console.log(`\n✅ Migrated ${migrated} patients to current key`);
            }
          }
        } catch (error) {
          console.error('Failed to process old key:', error.message);
        }
        break;
        
      case '3':
        // Clear encrypted data
        console.log('\n⚠️  WARNING: This will clear all encrypted patient names!');
        const confirm3 = await question('Are you sure? (yes/no): ');
        
        if (confirm3.toLowerCase() === 'yes') {
          await sequelize.query(`
            UPDATE "Patients" 
            SET "encryptedFirstName" = NULL, "encryptedLastName" = NULL
          `);
          console.log('\n✅ Cleared all encrypted patient names');
        }
        break;
        
      case '4':
        console.log('Exiting...');
        break;
        
      default:
        console.log('Invalid option');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
    await sequelize.close();
  }
}

main();