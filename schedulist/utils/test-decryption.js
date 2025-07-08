const db = require('../src/models');

async function testDecryption() {
  try {
    console.log('Testing patient decryption...');
    
    // Get first patient
    const patient = await db.Patient.findOne();
    
    if (!patient) {
      console.log('No patients found');
      return;
    }
    
    console.log('Patient raw data:', {
      id: patient.id,
      encryptedFirstName: patient.getDataValue('encryptedFirstName')?.substring(0, 50) + '...',
      encryptedLastName: patient.getDataValue('encryptedLastName')?.substring(0, 50) + '...',
    });
    
    console.log('Patient decrypted data:', {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
    });
    
    // Test decryption manually
    try {
      const testDecryption = patient.decryptField('encryptedFirstName');
      console.log('Manual decryption test:', testDecryption);
    } catch (error) {
      console.error('Manual decryption failed:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await db.sequelize.close();
  }
}

testDecryption();