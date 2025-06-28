const db = require('../src/models');
const { encrypt } = require('../src/utils/encryption');

async function fixEncryption() {
  try {
    console.log('Starting encryption fix...');
    
    // Get all patients
    const patients = await db.Patient.findAll({
      attributes: [
        'id',
        'encryptedFirstName',
        'encryptedLastName',
        'encryptedDateOfBirth',
        'encryptedInsuranceProvider',
        'encryptedInsuranceId',
        'encryptedPhone',
        'encryptedAddress'
      ]
    });
    
    console.log(`Found ${patients.length} patients to fix`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const patient of patients) {
      const updates = {};
      let needsUpdate = false;
      
      // Check each encrypted field
      const fieldsToCheck = [
        { encrypted: 'encryptedFirstName', original: 'firstName' },
        { encrypted: 'encryptedLastName', original: 'lastName' },
        { encrypted: 'encryptedDateOfBirth', original: 'dateOfBirth' },
        { encrypted: 'encryptedInsuranceProvider', original: 'insuranceProvider' },
        { encrypted: 'encryptedInsuranceId', original: 'insuranceId' },
        { encrypted: 'encryptedPhone', original: 'phone' },
        { encrypted: 'encryptedAddress', original: 'address' }
      ];
      
      for (const field of fieldsToCheck) {
        const value = patient[field.encrypted];
        
        // Check if value exists and doesn't look like encrypted data (missing colon separator)
        if (value && !value.includes(':')) {
          console.log(`Patient ${patient.id}: ${field.encrypted} needs encryption`);
          
          // The plain text value is stored in the encrypted field
          // Encrypt it properly
          updates[field.encrypted] = encrypt(value);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await db.Patient.update(updates, {
          where: { id: patient.id },
          validate: false, // Skip validation to allow direct update of encrypted fields
          hooks: false // Skip hooks to prevent double encryption
        });
        fixed++;
        console.log(`Fixed patient ${patient.id}`);
      } else {
        skipped++;
      }
    }
    
    console.log(`\nEncryption fix complete!`);
    console.log(`Fixed: ${fixed} patients`);
    console.log(`Skipped: ${skipped} patients (already encrypted)`);
    
  } catch (error) {
    console.error('Error fixing encryption:', error);
  } finally {
    await db.sequelize.close();
  }
}

// Run the fix
fixEncryption();