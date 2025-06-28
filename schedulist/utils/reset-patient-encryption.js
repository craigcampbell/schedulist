const db = require('../src/models');
const { faker } = require('@faker-js/faker');

async function resetPatientEncryption() {
  try {
    console.log('Starting patient data reset with proper encryption...\n');
    
    // Get all patients
    const patients = await db.Patient.findAll({
      include: [{
        model: db.Organization,
        attributes: ['id', 'name']
      }]
    });
    
    console.log(`Found ${patients.length} patients to reset\n`);
    
    let processed = 0;
    
    for (const patient of patients) {
      // Generate new fake data for this patient
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const dateOfBirth = faker.date.birthdate({ min: 2, max: 17, mode: 'age' });
      const insuranceProvider = faker.helpers.arrayElement(['Blue Cross', 'Aetna', 'United Healthcare', 'Cigna', 'Anthem']);
      const insuranceId = faker.finance.accountNumber();
      const phone = faker.phone.number();
      const address = faker.location.streetAddress() + ', ' + faker.location.city() + ', ' + faker.location.state() + ' ' + faker.location.zipCode();
      
      // Update using the virtual fields which will handle encryption automatically
      await patient.update({
        firstName,
        lastName,
        dateOfBirth: dateOfBirth.toISOString(),
        insuranceProvider,
        insuranceId,
        phone,
        address
      });
      
      processed++;
      console.log(`[${processed}/${patients.length}] Reset patient: ${firstName} ${lastName} (Org: ${patient.Organization?.name || 'None'})`);
    }
    
    console.log(`\n✅ Patient data reset complete!`);
    console.log(`Processed: ${processed} patients`);
    console.log(`\nAll patient data has been regenerated and properly encrypted with the current encryption key.`);
    
  } catch (error) {
    console.error('❌ Error resetting patient data:', error);
    console.error('\nStack trace:', error.stack);
  } finally {
    await db.sequelize.close();
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  WARNING: This will reset all patient data with new fake data!');
console.log('This is necessary to fix the encryption key mismatch.');
console.log('');

rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    rl.close();
    resetPatientEncryption();
  } else {
    console.log('Operation cancelled.');
    rl.close();
    process.exit(0);
  }
});